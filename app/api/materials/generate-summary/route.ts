import type { Category, City, Country } from '@/lib/types'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import JSON5 from 'json5'
import { jsonrepair } from 'jsonrepair'

const DEFAULT_ANALYSIS_PROMPT = `Ты - аналитик новостного контента. Проанализируй статью и предоставь структурированный результат.

ЗАДАЧИ:

1. META_DESCRIPTION (150-160 символов):
   - Краткое описание сути статьи для SEO
   - Нейтральный тон, максимально информативно
   - Для поисковых систем и социальных сетей

2. SUMMARY (3-5 предложений):
   - Выдели основные моменты и ключевые идеи
   - Профессиональный аналитический стиль
   - Полностью нейтральное изложение без эмоциональной окраски
   - Простой человеческий язык для комфортного восприятия
   - ВАЖНО: Перефразируй своими словами, НЕ копируй предложения из оригинала
   - SEO уникальность 90%+

3. SENTIMENT (тональность материала):
   - positive (позитивная)
   - neutral (нейтральная)
   - negative (негативная)

4. CONTENT_TYPE (тип контента):
   - purely_factual (новостная заметка, только факты)
   - mostly_factual (преимущественно факты с элементами анализа)
   - balanced (факты и мнения примерно поровну)
   - mostly_opinion (аналитика с мнениями)
   - purely_opinion (авторская колонка, редакционная статья)

5. TAXONOMY (классификация):
   - Определи подходящие категории, а также страны и города, связанные с материалом

Ответ должен быть на русском языке в формате JSON с полями: meta_description, summary, sentiment, content_type, taxonomy.`

const DEFAULT_TAXONOMY_SYSTEM_PROMPT =
  'Ты — редактор аналитического портала. Определи подходящие категории, а также страну и города статьи так, чтобы они помогали редакции быстро рубрицировать материалы.'
const DEFAULT_TAXONOMY_FORMAT_PROMPT =
  'Верни ответ строго в формате JSON:\n{\n  "summary": "краткое резюме на русском",\n  "taxonomy": {\n    "categories": ["Название категории"],\n    "country": "Название страны или null",\n    "city": "Название города или null"\n  }\n}\nНе добавляй пояснений. Если не удалось определить значение, используй null.'

type PromptType = 'category' | 'country' | 'city'

const DEFAULT_TAXONOMY_PROMPTS: Record<PromptType, string> = {
  category:
    'Выбери одну или несколько категорий, которые наилучшим образом описывают материал. Если подходящей категории нет, предложи новую аккуратную формулировку.',
  country: 'Выбери страну, если материал ясно связан с конкретным государством.',
  city: 'Укажи город, если он явно присутствует в материале и важен для контекста.',
}

const MAX_CONTENT_LENGTH = 15000

type AIProvider = 'gemini' | 'claude'

async function callGemini(apiKey: string, model: string, prompt: string) {
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('')
      .trim() ?? ''
  )
}

const CLAUDE_MODEL_PREFERENCE = [
  'claude-3-5-sonnet-20240620',
  'claude-3-haiku-20240307',
]

async function callClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
) {
  const anthropic = new Anthropic({
    apiKey: apiKey,
  })

  const requestedModel = model || CLAUDE_MODEL_PREFERENCE[0]
  const tried = new Set<string>()
  const candidates = [
    requestedModel,
    ...CLAUDE_MODEL_PREFERENCE,
  ].filter((candidate) => {
    if (tried.has(candidate)) return false
    tried.add(candidate)
    return true
  })

  let lastError: Error | null = null

  for (const candidate of candidates) {
    try {
      const message = await anthropic.messages.create({
        model: candidate,
        max_tokens: 4096,
        system: systemPrompt || undefined,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      })

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : ''

      const cleanText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      if (candidate !== requestedModel) {
        try {
          await db.setSetting('claude_model', candidate)
        } catch (persistError) {
          console.warn('Не удалось сохранить новую модель Claude:', persistError)
        }
      }

      return cleanText
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Unknown error'
      const errorType = error?.error?.type || error?.type || 'unknown'
      const statusCode = error?.status ?? error?.response?.status
      const messageLower = typeof errorMessage === 'string' ? errorMessage.toLowerCase() : ''
      const isModelNotFound =
        errorType === 'not_found_error' ||
        statusCode === 404 ||
        messageLower.includes('not found') ||
        messageLower.includes('model:')

      if (isModelNotFound) {
        console.warn(`Claude model "${candidate}" недоступна. Пробуем альтернативу.`)
        lastError = new Error(`Модель ${candidate} недоступна`)
        continue
      }

      throw new Error(`Claude API error: ${errorType} - ${errorMessage}`)
    }
  }

  throw new Error(
    lastError?.message || 'Claude API error: нет доступных моделей для выполнения запроса'
  )
}

const normalizeName = (value?: string | null) =>
  (value ?? '').normalize('NFKC').trim().toLowerCase()

const sanitizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const extractJsonFromText = (text: string): string | null => {
  if (!text) return null
  
  // Убираем markdown блоки если они есть
  let cleanText = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  
  // Ищем JSON объект
  const start = cleanText.indexOf('{')
  const end = cleanText.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  
  return cleanText.slice(start, end + 1)
}

const buildTaxonomyContext = (
  countries: Array<Country & { cities: City[] }>,
  categories: Category[]
) => {
  const countryLines =
    countries.length > 0
      ? countries.map((country) => {
          const cityNames = (country.cities ?? []).map((city) => city.name)
          return cityNames.length > 0
            ? `${country.name}: ${cityNames.join(', ')}`
            : country.name
        })
      : ['(пока нет сохранённых стран)']

  const categoryLine =
    categories.length > 0
      ? categories.map((category) => category.name).join(', ')
      : '(пока нет категорий)'

  return [
    'Страны и города: ' + countryLines.join(' | '),
    'Категории: ' + categoryLine,
    'Если подходящего значения нет, предложи новое аккуратное название.',
  ].join('\n')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { materialId } = body

    if (!materialId) {
      return NextResponse.json(
        { success: false, error: 'Material ID is required' },
        { status: 400 }
      )
    }

    const settings = await db.getSettings()
    const aiProvider = (settings['ai_provider'] || 'gemini') as AIProvider
    const geminiApiKey = settings['gemini_api_key']
    const claudeApiKey = settings['claude_api_key']
    const geminiModel = settings['gemini_model'] || 'gemini-2.5-flash'
    const claudeModel = settings['claude_model'] || 'claude-3-haiku-20240307'
    const analysisPrompt = settings['analysis_prompt'] || DEFAULT_ANALYSIS_PROMPT
    const taxonomySystemPrompt = settings['taxonomy_system_prompt']
    const taxonomyFormatPrompt = settings['taxonomy_format_prompt']
    const taxonomyPrompts: Record<PromptType, string> = {
      category:
        settings['taxonomy_prompt_category'] ?? DEFAULT_TAXONOMY_PROMPTS.category,
      country:
        settings['taxonomy_prompt_country'] ?? DEFAULT_TAXONOMY_PROMPTS.country,
      city:
        settings['taxonomy_prompt_city'] ?? DEFAULT_TAXONOMY_PROMPTS.city,
    }

    const apiKey = aiProvider === 'claude' ? claudeApiKey : geminiApiKey
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: `${aiProvider === 'claude' ? 'Claude' : 'Gemini'} API ключ не настроен. Перейдите в Настройки.`,
        },
        { status: 400 }
      )
    }

    const material = await db.getMaterialById(materialId)

    if (!material) {
      return NextResponse.json(
        { success: false, error: 'Material not found' },
        { status: 404 }
      )
    }

    let contentToAnalyze = material.fullContent || material.content
    
    if (!contentToAnalyze || contentToAnalyze.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Материал не содержит текста для анализа',
        },
        { status: 400 }
      )
    }
    
    if (contentToAnalyze.length > MAX_CONTENT_LENGTH) {
      console.log(
        `Content too long (${contentToAnalyze.length}), truncating to ${MAX_CONTENT_LENGTH}`
      )
      contentToAnalyze =
        contentToAnalyze.substring(0, MAX_CONTENT_LENGTH) + '...'
    }
    
    const taxonomyData = (await db.getTaxonomy()) as {
      categories: Category[]
      countries: Array<Country & { cities: City[] }>
    }

    const systemPromptSections = [
      analysisPrompt,
      taxonomySystemPrompt || DEFAULT_TAXONOMY_SYSTEM_PROMPT,
      `Правила для категорий: ${taxonomyPrompts.category}`,
      `Правила для стран: ${taxonomyPrompts.country}`,
      `Правила для городов: ${taxonomyPrompts.city}`,
      'Вот доступные справочники для ориентира:',
      buildTaxonomyContext(taxonomyData.countries, taxonomyData.categories),
    ]

    const systemPrompt = systemPromptSections.filter(Boolean).join('\n\n')

    const userPromptSections = [
      'Проанализируй статью и предоставь результат.',
      'СТАТЬЯ:',
      contentToAnalyze,
      'Верни ответ строго в формате JSON:',
      `{
  "meta_description": "150-160 символов для SEO, без ссылок на статью",
  "summary": "3-5 предложений с ключевыми фактами",
  "sentiment": "positive | neutral | negative",
  "content_type": "purely_factual | mostly_factual | balanced | mostly_opinion | purely_opinion",
  "taxonomy": {
    "categories": ["Название категории"],
    "country": "Название страны или null",
    "city": "Название города или null"
  }
}`,
    ]

    if (taxonomyFormatPrompt) {
      userPromptSections.push('Дополнительные требования к формату:', taxonomyFormatPrompt)
    }

    userPromptSections.push('Только чистый JSON без markdown, без дополнительного текста и комментариев.')

    const userPrompt = userPromptSections.join('\n\n')

    const geminiPrompt = [systemPrompt, userPrompt].filter(Boolean).join('\n\n')

    console.log(
      `Generating analysis for material ${materialId} using ${aiProvider}. Content length: ${contentToAnalyze.length}`
    )

    let textResponse: string
    try {
      if (aiProvider === 'claude') {
        textResponse = await callClaude(apiKey, claudeModel, systemPrompt, userPrompt)
      } else {
        textResponse = await callGemini(apiKey, geminiModel, geminiPrompt)
      }
    } catch (error) {
      console.error(`Error calling ${aiProvider} API:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(
        {
          success: false,
          error: `Ошибка при обращении к ${aiProvider === 'claude' ? 'Claude' : 'Gemini'} API: ${errorMessage}`,
        },
        { status: 500 }
      )
    }

    console.log(
      `${aiProvider} response (truncated):`,
      textResponse.slice(0, 500) + (textResponse.length > 500 ? '...' : '')
    )

    const jsonPayload = extractJsonFromText(textResponse)

    if (!jsonPayload) {
      console.error(`${aiProvider} response is not valid JSON. Full text:`, textResponse)
      return NextResponse.json(
        {
          success: false,
          error: `Нейросеть вернула ответ в неожиданном формате. Уточните промпт для JSON.`,
        },
        { status: 500 }
      )
    }

    let parsedResponse: {
      meta_description?: string
      summary?: string
      sentiment?: 'positive' | 'neutral' | 'negative'
      content_type?: 'purely_factual' | 'mostly_factual' | 'balanced' | 'mostly_opinion' | 'purely_opinion'
      taxonomy?: {
        categories?: string[] | null
        country?: string | null
        city?: string | null
        themes?: unknown
        tags?: unknown
        alliances?: unknown
      }
    }

    try {
      parsedResponse = JSON.parse(jsonPayload)
    } catch (firstError) {
      let secondError: unknown = null
      try {
        parsedResponse = JSON5.parse(jsonPayload)
      } catch (json5Error) {
        secondError = json5Error
        try {
          const repaired = jsonrepair(jsonPayload)
          parsedResponse = JSON.parse(repaired)
        } catch (repairError) {
          console.error(
            `Failed to parse JSON from ${aiProvider}:`,
            repairError,
            'JSON5 error:',
            secondError,
            'Original error:',
            firstError,
            'Payload:',
            jsonPayload
          )
          return NextResponse.json(
            {
              success: false,
              error: 'Не удалось разобрать JSON от нейросети. Проверьте формат ответа.',
            },
            { status: 500 }
          )
        }
      }
    }

    const summary = sanitizeString(parsedResponse.summary)
    const metaDescription = sanitizeString(parsedResponse.meta_description)
    const sentiment = parsedResponse.sentiment as 'positive' | 'neutral' | 'negative' | undefined
    const contentType = parsedResponse.content_type as 'purely_factual' | 'mostly_factual' | 'balanced' | 'mostly_opinion' | 'purely_opinion' | undefined

    if (!summary) {
      console.error('Summary is missing in parsed response:', parsedResponse)
      return NextResponse.json(
        {
          success: false,
          error: 'Нейросеть не вернула саммари. Уточните промпт или повторите попытку.',
        },
        { status: 500 }
      )
    }

    const taxonomyResult = (parsedResponse.taxonomy ?? {}) as {
      categories?: string[] | null
      country?: string | null
      city?: string | null
    }

    const hasCategories = Object.prototype.hasOwnProperty.call(
      taxonomyResult,
      'categories'
    )
    const hasCountry = Object.prototype.hasOwnProperty.call(
      taxonomyResult,
      'country'
    )
    const hasCity = Object.prototype.hasOwnProperty.call(
      taxonomyResult,
      'city'
    )
    const countryName =
      taxonomyResult.country !== null
        ? sanitizeString(taxonomyResult.country)
        : ''
    const cityName =
      taxonomyResult.city !== null
        ? sanitizeString(taxonomyResult.city)
        : ''

    const countryByName = new Map<
      string,
      (typeof taxonomyData.countries)[number]
    >()
    const cityByName = new Map<string, Array<City>>()

    taxonomyData.countries.forEach((country) => {
      countryByName.set(normalizeName(country.name), country)
      ;(country.cities ?? []).forEach((city) => {
        const key = normalizeName(city.name)
        if (!cityByName.has(key)) {
          cityByName.set(key, [])
        }
        cityByName.get(key)?.push(city)
      })
    })

    const ensureCountry = async (name: string) => {
      const key = normalizeName(name)
      if (key.length === 0) return null
      const existing = countryByName.get(key)
      if (existing) return existing

      const created = await db.createTaxonomyItem('country', name)
      const enriched = { ...created, cities: [] as City[] }
      countryByName.set(key, enriched)
      taxonomyData.countries.push(enriched)
      return enriched
    }

    const ensureCity = async (name: string, countryIdHint?: number | null) => {
      const key = normalizeName(name)
      if (key.length === 0) return null
      const candidates = cityByName.get(key) ?? []

      if (candidates.length > 0) {
        const preferred =
          candidates.find((item) =>
            countryIdHint ? item.countryId === countryIdHint : true
          ) ?? candidates[0]

        if (
          countryIdHint &&
          preferred.countryId !== countryIdHint &&
          !countryIds.includes(preferred.countryId)
        ) {
          countryIds.push(preferred.countryId)
          shouldUpdateCountries = true
        }

        return preferred
      }

      if (!countryIdHint) {
        console.warn(
          `City "${name}" cannot be created without a country reference. Skipping.`
        )
        return null
      }

      const created = await db.createTaxonomyItem('city', name, {
        countryId: countryIdHint,
      })

      const enriched = created as City
      if (!cityByName.has(key)) {
        cityByName.set(key, [])
      }
      cityByName.get(key)!.push(enriched)

      const parentCountry = taxonomyData.countries.find(
        (country) => country.id === countryIdHint
      )
      if (parentCountry) {
        parentCountry.cities = [...(parentCountry.cities ?? []), enriched]
      } else {
        const fallbackCountry = taxonomyData.countries.find(
          (country) => country.id === enriched.countryId
        )
        if (fallbackCountry) {
          fallbackCountry.cities = [...(fallbackCountry.cities ?? []), enriched]
        }
      }

      return enriched
    }

    const taxonomyUpdatePayload: {
      categoryIds?: number[]
      countryIds?: number[]
      cityIds?: number[]
    } = {}

    const categoryIds: number[] = []
    const countryIds: number[] = []
    const cityIds: number[] = []
    let shouldUpdateCategories = hasCategories
    let shouldUpdateCountries = hasCountry
    let shouldUpdateCities = hasCity

    const categoryByName = new Map<string, Category>()
    taxonomyData.categories.forEach((category) => {
      categoryByName.set(normalizeName(category.name), category)
    })

    const ensureCategory = async (name: string) => {
      const key = normalizeName(name)
      if (key.length === 0) return null
      const existing = categoryByName.get(key)
      if (existing) return existing

      const created = await db.createTaxonomyItem('category', name)
      categoryByName.set(key, created)
      taxonomyData.categories.push(created)
      return created
    }

    if (hasCategories) {
      const categoryNames = Array.isArray(taxonomyResult.categories)
        ? taxonomyResult.categories
        : []

      for (const rawName of categoryNames) {
        const categoryName = sanitizeString(rawName)
        if (!categoryName) continue
        try {
          const category = await ensureCategory(categoryName)
          if (category && !categoryIds.includes(category.id)) {
            categoryIds.push(category.id)
          }
        } catch (error) {
          console.error('Failed to ensure category:', categoryName, error)
        }
      }
    }

    if (hasCountry) {
      if (countryName) {
        try {
          const country = await ensureCountry(countryName)
          if (country) {
            countryIds.push(country.id)
          }
        } catch (error) {
          console.error('Failed to ensure country:', countryName, error)
        }
      }
    }

    if (hasCity) {
      if (cityName) {
        try {
          const city = await ensureCity(
            cityName,
            countryIds[0] ?? null
          )
          if (city) {
            if (!cityIds.includes(city.id)) {
              cityIds.push(city.id)
            }
            if (!countryIds.includes(city.countryId)) {
              countryIds.push(city.countryId)
            }
            shouldUpdateCountries = true
          }
        } catch (error) {
          console.error('Failed to ensure city:', cityName, error)
        }
      }
    }

    if (shouldUpdateCategories) {
      taxonomyUpdatePayload.categoryIds = categoryIds
    }

    if (shouldUpdateCountries) {
      taxonomyUpdatePayload.countryIds = countryIds
    }

    if (shouldUpdateCities) {
      taxonomyUpdatePayload.cityIds = cityIds
    }

    // Сохраняем все поля, даже если они пустые (но не undefined)
    await db.updateMaterialSummary(materialId, {
      summary,
      metaDescription: metaDescription || undefined, // Сохраняем только если не пустая строка
      sentiment: sentiment || undefined,
      contentType: contentType || undefined,
      setProcessed: true, // Автоматически устанавливаем статус "processed" после успешной генерации
    })

    const shouldUpdateTaxonomy =
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'categoryIds') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'countryIds') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'cityIds')

    if (shouldUpdateTaxonomy) {
      try {
        await db.updateMaterialTaxonomy(materialId, taxonomyUpdatePayload)
      } catch (error) {
        console.error(
          'Failed to update taxonomy for material:',
          materialId,
          taxonomyUpdatePayload,
          error
        )
      }
    }

    const updatedMaterial = await db.getMaterialById(materialId)

    return NextResponse.json({
      success: true,
      data: {
        summary,
        metaDescription: metaDescription || undefined,
        sentiment: sentiment || undefined,
        contentType: contentType || undefined,
        material: updatedMaterial,
      },
    })
  } catch (error) {
    console.error('Error generating summary and taxonomy:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

