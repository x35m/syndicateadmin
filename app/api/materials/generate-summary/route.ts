import type { Category, City, Country } from '@/lib/types'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  runCategoryClassification,
  parseJsonWithFallback,
} from '@/lib/ai/category-classifier'
import { callClaude, CLAUDE_MODEL_PREFERENCE } from '@/lib/ai/anthropic'
import { logSystemError } from '@/lib/logger'

const DEFAULT_ANALYSIS_PROMPT = `Ты - аналитик новостного контента. Проанализируй статью и предоставь структурированный результат.

ЗАДАЧИ:

1. SENTIMENT (тональность материала):
   - positive (позитивная)
   - neutral (нейтральная)
   - negative (негативная)

2. CONTENT_TYPE (тип контента):
   - purely_factual (новостная заметка, только факты)
   - mostly_factual (преимущественно факты с элементами анализа)
   - balanced (факты и мнения примерно поровну)
   - mostly_opinion (аналитика с мнениями)
   - purely_opinion (авторская колонка, редакционная статья)

3. TAXONOMY (классификация):
   - Определи подходящие категории, а также страны и города, связанные с материалом

Ответ должен быть на русском языке в формате JSON с полями: sentiment, content_type, taxonomy.`

const DEFAULT_TAXONOMY_SYSTEM_PROMPT =
  'Ты — редактор аналитического портала. Определи подходящие категории, а также страну и города статьи так, чтобы они помогали редакции быстро рубрицировать материалы.'
const DEFAULT_TAXONOMY_FORMAT_PROMPT =
  'Верни ответ строго в формате JSON:\n{\n  "taxonomy": {\n    "categories": ["Название категории"],\n    "country": "Название страны или null",\n    "city": "Название города или null"\n  }\n}\nНе добавляй пояснений. Если не удалось определить значение, используй null.'

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
  let materialIdForLog: string | undefined
  try {
    const body = await request.json()
    const { materialId } = body

    materialIdForLog = typeof materialId === 'string' ? materialId : undefined

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
    const claudeModel = settings['claude_model'] || CLAUDE_MODEL_PREFERENCE[0]
    const analysisPrompt = settings['analysis_prompt'] || DEFAULT_ANALYSIS_PROMPT
    const taxonomySystemPrompt = settings['taxonomy_system_prompt']
    const taxonomyFormatPrompt = settings['taxonomy_format_prompt']
    const taxonomyPrompts: Record<PromptType, string> = {
      category: settings['taxonomy_prompt_category'] ?? DEFAULT_TAXONOMY_PROMPTS.category,
      country: settings['taxonomy_prompt_country'] ?? DEFAULT_TAXONOMY_PROMPTS.country,
      city: settings['taxonomy_prompt_city'] ?? DEFAULT_TAXONOMY_PROMPTS.city,
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
    
    const [taxonomyDataRaw, categoryExamples] = await Promise.all([
      db.getTaxonomy(),
      db.getCategoryExamples(15),
    ])

    const taxonomyData = taxonomyDataRaw as {
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
      await logSystemError('api/materials/generate-summary', error, {
        materialId,
        provider: aiProvider,
        phase: 'call-model',
      })
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
      await logSystemError('api/materials/generate-summary', 'Invalid JSON payload', {
        materialId,
        provider: aiProvider,
        phase: 'extract-json',
        responsePreview: textResponse.slice(0, 2000),
      })
      return NextResponse.json(
        {
          success: false,
          error: `Нейросеть вернула ответ в неожиданном формате. Уточните промпт для JSON.`,
        },
        { status: 500 }
      )
    }

    let parsedResponse: {
      sentiment?: 'positive' | 'neutral' | 'negative'
      content_type?:
        | 'purely_factual'
        | 'mostly_factual'
        | 'balanced'
        | 'mostly_opinion'
        | 'purely_opinion'
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
      parsedResponse = parseJsonWithFallback(jsonPayload) as typeof parsedResponse
    } catch (error) {
      console.error(`Failed to parse JSON from ${aiProvider}:`, error, 'Payload:', jsonPayload)
      await logSystemError('api/materials/generate-summary', error, {
        materialId,
        provider: aiProvider,
        phase: 'parse-json',
        payloadSnippet: jsonPayload.slice(0, 2000),
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Не удалось разобрать JSON от нейросети. Проверьте формат ответа.',
        },
        { status: 500 }
      )
    }

    const sentiment = parsedResponse.sentiment as 'positive' | 'neutral' | 'negative' | undefined
    const contentType = parsedResponse.content_type as
      | 'purely_factual'
      | 'mostly_factual'
      | 'balanced'
      | 'mostly_opinion'
      | 'purely_opinion'
      | undefined

    const advancedCategoryResult = await runCategoryClassification({
      materialId,
      articleText: contentToAnalyze,
      materialTitle: material.title,
      categories: taxonomyData.categories,
      examples: categoryExamples,
      claudeApiKey,
      claudeModel,
    })

    const taxonomyResult = (parsedResponse.taxonomy ?? {}) as {
      categories?: string[] | null
      country?: string | null
      city?: string | null
    }

    const categoryNamesRaw = Array.isArray(taxonomyResult.categories)
      ? taxonomyResult.categories
      : []
    const countryName = taxonomyResult.country ? sanitizeString(taxonomyResult.country) : ''
    const cityName = taxonomyResult.city ? sanitizeString(taxonomyResult.city) : ''

    const taxonomyUpdatePayload: {
      categoryIds?: number[]
      countryIds?: number[]
      cityIds?: number[]
    } = {}

    const categoryIds: number[] = []
    const countryIds: number[] = []
    const cityIds: number[] = []
    let shouldUpdateCountries = false

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

    const rawCategoryNames: string[] = [
      ...(advancedCategoryResult?.category ? [advancedCategoryResult.category] : []),
      ...categoryNamesRaw,
    ]

    const categoryNames = rawCategoryNames
      .map((name) => sanitizeString(name))
      .filter((name) => name.length > 0)

    if (categoryNames.length > 0) {
      for (const categoryName of categoryNames) {
        try {
          const category = await ensureCategory(categoryName)
          if (category && !categoryIds.includes(category.id)) {
            categoryIds.push(category.id)
          }
        } catch (error) {
          console.error('Failed to ensure category:', categoryName, error)
        }
      }
      taxonomyUpdatePayload.categoryIds = categoryIds
    }

    if (countryName) {
      try {
        const country = await ensureCountry(countryName)
        if (country) {
          countryIds.push(country.id)
          shouldUpdateCountries = true
        }
      } catch (error) {
        console.error('Failed to ensure country:', countryName, error)
      }
    }

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
            shouldUpdateCountries = true
          }
        }
      } catch (error) {
        console.error('Failed to ensure city:', cityName, error)
      }
    }

    if (shouldUpdateCountries && countryIds.length > 0) {
      taxonomyUpdatePayload.countryIds = countryIds
    }
    if (cityIds.length > 0) {
      taxonomyUpdatePayload.cityIds = cityIds
    }

    await db.updateMaterialSummary(materialId, {
      summary: null,
      metaDescription: null,
      sentiment: sentiment || undefined,
      contentType: contentType || undefined,
      setProcessed: true,
    })

    if (Object.keys(taxonomyUpdatePayload).length > 0) {
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

    const modelUsed = aiProvider === 'claude' ? claudeModel : geminiModel
    // Учет вызова (без точных токенов — не все провайдеры возвращают их по API)
    await db.addAiUsage({
      provider: aiProvider,
      model: modelUsed,
      action: 'taxonomy',
      tokensIn: null,
      tokensOut: null,
    })

    return NextResponse.json({
      success: true,
      data: {
        sentiment: sentiment || undefined,
        contentType: contentType || undefined,
        material: updatedMaterial,
        classification: advancedCategoryResult
          ? {
              category: advancedCategoryResult.category,
              confidence: advancedCategoryResult.confidence,
              supercategory: advancedCategoryResult.supercategory ?? null,
              reasoning: advancedCategoryResult.reasoning,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Error generating taxonomy data:', error)
    await logSystemError('api/materials/generate-summary', error, {
      materialId: materialIdForLog,
      phase: 'handler',
    })
    return NextResponse.json(
      { success: false, error: 'Failed to process material' },
      { status: 500 }
    )
  }
}

