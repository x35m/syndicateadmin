import type { Category, City, Country } from '@/lib/types'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  runCategoryClassification,
  parseJsonWithFallback,
} from '@/lib/ai/category-classifier'
import { callClaude, CLAUDE_MODEL_PREFERENCE } from '@/lib/ai/anthropic'
import { logSystemError } from '@/lib/logger'

const MAX_CONTENT_LENGTH = 15000

type AIProvider = 'gemini' | 'claude'
type PromptType = 'category' | 'country' | 'city'

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

  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
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

const DEFAULT_TAXONOMY_FORMAT_PROMPT = `Верни только JSON объект со следующей структурой:
{
  "categories": ["название категории"],
  "country": "название страны" или null,
  "city": "название города" или null
}`

const DEFAULT_TAXONOMY_SYSTEM_PROMPT =
  'Ты — редактор аналитического портала. Определи подходящие категории, а также страну и города, чтобы редакция могла быстро рубрицировать материалы.'

const DEFAULT_TAXONOMY_PROMPTS: Record<PromptType, string> = {
  category:
    'Выбери одну или несколько категорий, которые наилучшим образом описывают материал. Если подходящей категории нет, предложи новую аккуратную формулировку.',
  country: 'Выбери страну, если материал ясно связан с конкретным государством.',
  city: 'Укажи город, если он явно присутствует в материале и важен для контекста.',
}

export async function POST(request: Request) {
  let materialIdForLog: string | undefined
  try {
    const { materialId } = await request.json()

    materialIdForLog = typeof materialId === 'string' ? materialId : undefined

    if (!materialId) {
      return NextResponse.json(
        { success: false, error: 'Material ID is required' },
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

    const settings = await db.getSettings()
    const aiProvider = (settings['ai_provider'] || 'gemini') as AIProvider
    const geminiApiKey = settings['gemini_api_key']
    const claudeApiKey = settings['claude_api_key']
    const geminiModel = settings['gemini_model'] || 'gemini-2.5-flash'
    const claudeModel = settings['claude_model'] || CLAUDE_MODEL_PREFERENCE[0]
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

    const taxonomyDataRaw = await db.getTaxonomy()
    const taxonomyContext = buildTaxonomyContext(
      taxonomyDataRaw.countries,
      taxonomyDataRaw.categories
    )

    const taxonomySystemPrompt =
      settings['taxonomy_system_prompt'] || DEFAULT_TAXONOMY_SYSTEM_PROMPT
    const categoryPrompt =
      settings['taxonomy_prompt_category'] || DEFAULT_TAXONOMY_PROMPTS.category
    const countryPrompt =
      settings['taxonomy_prompt_country'] || DEFAULT_TAXONOMY_PROMPTS.country
    const cityPrompt =
      settings['taxonomy_prompt_city'] || DEFAULT_TAXONOMY_PROMPTS.city
    const formatPrompt =
      settings['taxonomy_format_prompt'] || DEFAULT_TAXONOMY_FORMAT_PROMPT

    const articleContent = material.fullContent || material.content || ''
    const truncatedContent =
      articleContent.length > MAX_CONTENT_LENGTH
        ? articleContent.slice(0, MAX_CONTENT_LENGTH) + '...'
        : articleContent

    const systemPromptSections = [
      taxonomySystemPrompt,
      'ПРАВИЛА ДЛЯ КАЖДОГО ТИПА:',
      `Категория: ${categoryPrompt}`,
      `Страна: ${countryPrompt}`,
      `Город: ${cityPrompt}`,
      'КОНТЕКСТ ДОСТУПНЫХ ЗНАЧЕНИЙ:',
      taxonomyContext,
    ]

    const systemPrompt = systemPromptSections.filter(Boolean).join('\n\n')

    const userPrompt = [
      'Определи категории, страну и города, связанные со статьёй.',
      '',
      'СТАТЬЯ:',
      `Заголовок: ${material.title}`,
      `Содержание: ${truncatedContent}`,
      '',
      'ФОРМАТ ОТВЕТА:',
      formatPrompt,
      '',
      'Только чистый JSON без markdown и дополнительного текста.',
    ].join('\n')

    const geminiPrompt = [systemPrompt, userPrompt].filter(Boolean).join('\n\n')

    let aiResponse: string
    try {
      aiResponse = await (aiProvider === 'claude'
        ? callClaude(apiKey, claudeModel, systemPrompt, userPrompt)
        : callGemini(apiKey, geminiModel, geminiPrompt))
    } catch (error) {
      console.error(`Error calling ${aiProvider} API:`, error)
      await logSystemError('api/materials/regenerate-taxonomy', error, {
        materialId,
        provider: aiProvider,
        phase: 'call-model',
      })
      const message = error instanceof Error ? error.message : 'Не удалось обратиться к AI'
      return NextResponse.json(
        {
          success: false,
          error: `Ошибка при обращении к ${aiProvider === 'claude' ? 'Claude' : 'Gemini'} API: ${message}`,
        },
        { status: 500 }
      )
    }

    const jsonText = extractJsonFromText(aiResponse)
    if (!jsonText) {
      await logSystemError('api/materials/regenerate-taxonomy', 'Invalid AI response format', {
        materialId,
        provider: aiProvider,
        phase: 'extract-json',
        responsePreview: aiResponse.slice(0, 2000),
      })
      return NextResponse.json(
        { success: false, error: 'AI не вернул корректный JSON ответ' },
        { status: 500 }
      )
    }

    let parsedTaxonomy: {
      categories?: string[] | null
      country?: string | null
      city?: string | null
    }

    try {
      parsedTaxonomy = parseJsonWithFallback(jsonText) as typeof parsedTaxonomy
    } catch (error) {
      console.error('Failed to parse taxonomy JSON:', error, 'Payload:', jsonText)
      await logSystemError('api/materials/regenerate-taxonomy', error, {
        materialId,
        provider: aiProvider,
        phase: 'parse-json',
        payloadSnippet: jsonText.slice(0, 2000),
      })
      return NextResponse.json(
        { success: false, error: 'Не удалось разобрать JSON от нейросети' },
        { status: 500 }
      )
    }

    const categoryNamesRaw = Array.isArray(parsedTaxonomy.categories)
      ? parsedTaxonomy.categories
      : []
    const countryName = parsedTaxonomy.country ? sanitizeString(parsedTaxonomy.country) : ''
    const cityName = parsedTaxonomy.city ? sanitizeString(parsedTaxonomy.city) : ''

    const materialContentForClassification = truncatedContent || material.content || ''
    const categoryExamples = await db.getCategoryExamples(15)
    const advancedCategoryResult = await runCategoryClassification({
      materialId,
      articleText: materialContentForClassification,
      materialTitle: material.title,
      categories: taxonomyDataRaw.categories,
      examples: categoryExamples,
      claudeApiKey,
      claudeModel,
    })

    const categoryNames = [
      ...(advancedCategoryResult?.category ? [advancedCategoryResult.category] : []),
      ...categoryNamesRaw,
    ]
      .map((name) => sanitizeString(name))
      .filter((name) => name.length > 0)

    const taxonomyUpdatePayload: {
      categoryIds?: number[]
      countryIds?: number[]
      cityIds?: number[]
    } = {}

    const categoryIds: number[] = []
    const countryIds: number[] = []
    const cityIds: number[] = []

    const categoryByName = new Map<string, Category>()
    taxonomyDataRaw.categories.forEach((category) => {
      categoryByName.set(normalizeName(category.name), category)
    })

    const ensureCategory = async (name: string) => {
      const key = normalizeName(name)
      if (key.length === 0) return null
      const existing = categoryByName.get(key)
      if (existing) return existing

      try {
        const created = await db.createTaxonomyItem('category', name)
        categoryByName.set(key, created)
        taxonomyDataRaw.categories.push(created)
        return created
      } catch (error) {
        console.error('Failed to create category:', name, error)
        return null
      }
    }

    const countryByName = new Map<string, Country & { cities: City[] }>()
    taxonomyDataRaw.countries.forEach((country) => {
      countryByName.set(normalizeName(country.name), {
        ...country,
        cities: country.cities ?? [],
      })
    })

    const cityByName = new Map<string, Array<City>>()
    taxonomyDataRaw.countries.forEach((country) => {
      ;(country.cities ?? []).forEach((city) => {
        const key = normalizeName(city.name)
        if (!cityByName.has(key)) {
          cityByName.set(key, [])
        }
        cityByName.get(key)!.push(city)
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
      taxonomyDataRaw.countries.push(enriched)
      return enriched
    }

    const ensureCity = async (name: string, countryIdHint?: number | null) => {
      const key = normalizeName(name)
      if (key.length === 0) return null
      const candidates = cityByName.get(key) ?? []

      if (candidates.length > 0) {
        const preferred =
          candidates.find((item) => (countryIdHint ? item.countryId === countryIdHint : true)) ??
          candidates[0]
        return preferred
      }

      if (!countryIdHint) {
        console.warn(`City "${name}" cannot be created without a country reference. Skipping.`)
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

      const parentCountry = taxonomyDataRaw.countries.find((country) => country.id === countryIdHint)
      if (parentCountry) {
        parentCountry.cities = [...(parentCountry.cities ?? []), enriched]
      }

      return enriched
    }

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
        if (country && !countryIds.includes(country.id)) {
          countryIds.push(country.id)
        }
      } catch (error) {
        console.error('Failed to ensure country:', countryName, error)
      }
    }

    if (cityName) {
      try {
        const countryIdHint = countryIds[0] ?? null
        const city = await ensureCity(cityName, countryIdHint)
        if (city) {
          if (!cityIds.includes(city.id)) {
            cityIds.push(city.id)
          }
          if (!countryIds.includes(city.countryId)) {
            countryIds.push(city.countryId)
          }
        }
      } catch (error) {
        console.error('Failed to ensure city:', cityName, error)
      }
    }

    if (countryIds.length > 0) {
      taxonomyUpdatePayload.countryIds = countryIds
    }
    if (cityIds.length > 0) {
      taxonomyUpdatePayload.cityIds = cityIds
    }

    if (Object.keys(taxonomyUpdatePayload).length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          material,
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
    }

    await db.updateMaterialTaxonomy(materialId, taxonomyUpdatePayload)
    const updatedMaterial = await db.getMaterialById(materialId)

    return NextResponse.json({
      success: true,
      data: {
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
    console.error('Error regenerating taxonomy:', error)
    await logSystemError('api/materials/regenerate-taxonomy', error, {
      materialId: materialIdForLog,
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to regenerate taxonomy' },
      { status: 500 }
    )
  }
}


