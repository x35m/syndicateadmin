import type { Alliance, Category, City, Country, Tag, Theme } from '@/lib/types'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

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

async function callClaude(apiKey: string, model: string, prompt: string) {
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
        messages: [
          {
            role: 'user',
            content: prompt,
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

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const unique = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    const trimmed = sanitizeString(item)
    if (trimmed.length > 0) {
      const key = normalizeName(trimmed)
      if (!unique.has(key)) {
        unique.add(key)
        result.push(trimmed)
      }
    }
  }
  return result
}

const extractJsonFromText = (text: string): string | null => {
  if (!text) return null
  
  let cleanText = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  
  const start = cleanText.indexOf('{')
  const end = cleanText.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  
  return cleanText.slice(start, end + 1)
}

const buildTaxonomyContext = (
  countries: Array<Country & { cities: City[] }>,
  themes: Theme[],
  tags: Tag[],
  alliances: Alliance[]
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

  const themeLine =
    themes.length > 0
      ? themes.map((theme) => theme.name).join(', ')
      : '(пока нет тем)'

  const tagLine =
    tags.length > 0 ? tags.map((tag) => tag.name).join(', ') : '(пока нет тегов)'

  const allianceLine =
    alliances.length > 0
      ? alliances.map((alliance) => alliance.name).join(', ')
      : '(пока нет союзов)'

  return [
    'Страны и города: ' + countryLines.join(' | '),
    'Темы: ' + themeLine,
    'Теги: ' + tagLine,
    'Политические союзы и блоки: ' + allianceLine,
    'Если подходящего значения нет, предложи новое аккуратное название.',
  ].join('\n')
}

const DEFAULT_TAXONOMY_FORMAT_PROMPT = `Верни только JSON объект со следующей структурой:
{
  "category": ["название категории"],
  "theme": ["название темы"],
  "tags": ["тег1", "тег2", ...],
  "country": "название страны" или null,
  "city": "название города" или null,
  "alliances": ["название союза1", "название союза2", ...]
}`

const DEFAULT_TAXONOMY_PROMPTS = {
  category: 'Определи основную категорию материала по его содержанию и тематике.',
  theme: 'Выбери тему, которая наиболее точно отражает основной сюжет или проблематику материала.',
  tags: 'Подбери 3-7 релевантных тегов, которые описывают ключевые аспекты материала.',
  alliance: 'Определи международные или региональные союзы, блоки и объединения, напрямую связанные с сюжетом материала.',
  country: 'Выбери страну, если материал ясно связан с конкретным государством.',
  city: 'Укажи город, если он явно присутствует в материале и важен для контекста.',
}

export async function POST(request: Request) {
  try {
    const { materialId } = await request.json()

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
    const claudeModel = settings['claude_model'] || 'claude-3-haiku-20240307'
    const apiKey = aiProvider === 'claude' ? claudeApiKey : geminiApiKey

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: `API key for ${aiProvider} is not configured`,
        },
        { status: 400 }
      )
    }

    const taxonomy = await db.getTaxonomy()
    const taxonomyContext = buildTaxonomyContext(
      taxonomy.countries,
      taxonomy.themes,
      taxonomy.tags,
      taxonomy.alliances
    )

    const categoryPrompt =
      settings['taxonomy_prompt_category'] || DEFAULT_TAXONOMY_PROMPTS.category
    const themePrompt =
      settings['taxonomy_prompt_theme'] || DEFAULT_TAXONOMY_PROMPTS.theme
    const tagPrompt = settings['taxonomy_prompt_tag'] || DEFAULT_TAXONOMY_PROMPTS.tags
    const alliancePrompt =
      settings['taxonomy_prompt_alliance'] || DEFAULT_TAXONOMY_PROMPTS.alliance
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

    const promptSections = [
      'Проанализируй статью и определи подходящие значения таксономии.',
      '',
      'КОНТЕКСТ ДОСТУПНЫХ ЗНАЧЕНИЙ:',
      taxonomyContext,
      '',
      'ПРАВИЛА ДЛЯ КАЖДОГО ТИПА:',
      `Категория: ${categoryPrompt}`,
      `Тема: ${themePrompt}`,
      `Теги: ${tagPrompt}`,
      `Политические союзы: ${alliancePrompt}`,
      `Страна: ${countryPrompt}`,
      `Город: ${cityPrompt}`,
      '',
      'СТАТЬЯ:',
      `Заголовок: ${material.title}`,
      `Содержание: ${truncatedContent}`,
      '',
      formatPrompt,
      '',
      'ВАЖНО: Верни только чистый JSON, без markdown разметки и дополнительного текста.',
    ]

    const fullPrompt = promptSections.join('\n')

    const aiResponse = await (aiProvider === 'claude'
      ? callClaude(apiKey, claudeModel, fullPrompt)
      : callGemini(apiKey, geminiModel, fullPrompt))

    const jsonText = extractJsonFromText(aiResponse)
    if (!jsonText) {
      throw new Error('Failed to extract JSON from AI response')
    }

    const taxonomyData = JSON.parse(jsonText) as {
      category?: string | string[]
      theme?: string | string[]
      tags?: string | string[]
      country?: string | null
      city?: string | null
      alliances?: string | string[]
    }

    const categoryNames = sanitizeStringArray(
      Array.isArray(taxonomyData.category)
        ? taxonomyData.category
        : taxonomyData.category
        ? [taxonomyData.category]
        : []
    )

    const themeNames = sanitizeStringArray(
      Array.isArray(taxonomyData.theme)
        ? taxonomyData.theme
        : taxonomyData.theme
        ? [taxonomyData.theme]
        : []
    )

    const tagNames = sanitizeStringArray(taxonomyData.tags || [])
    const allianceNames = sanitizeStringArray(taxonomyData.alliances || [])
    const countryName = sanitizeString(taxonomyData.country)
    const cityName = sanitizeString(taxonomyData.city)

    const hasCountry = Object.prototype.hasOwnProperty.call(
      taxonomyData,
      'country'
    )
    const hasCity = Object.prototype.hasOwnProperty.call(
      taxonomyData,
      'city'
    )

    const taxonomyUpdatePayload: {
      categoryIds?: number[]
      themeIds?: number[]
      tagIds?: number[]
      allianceIds?: number[]
      countryIds?: number[]
      cityIds?: number[]
    } = {}

    const categoryByName = new Map<string, Category>()
    for (const cat of taxonomy.categories) {
      categoryByName.set(normalizeName(cat.name), cat)
    }

    const themeByName = new Map<string, Theme>()
    for (const theme of taxonomy.themes) {
      themeByName.set(normalizeName(theme.name), theme)
    }

    const tagByName = new Map<string, Tag>()
    for (const tag of taxonomy.tags) {
      tagByName.set(normalizeName(tag.name), tag)
    }

    const allianceByName = new Map<string, Alliance>()
    for (const alliance of taxonomy.alliances) {
      allianceByName.set(normalizeName(alliance.name), alliance)
    }

    const countryByName = new Map<string, Country & { cities: City[] }>()
    for (const country of taxonomy.countries) {
      countryByName.set(normalizeName(country.name), country)
    }

    const ensureCategory = async (name: string): Promise<Category | null> => {
      const normalized = normalizeName(name)
      const existing = categoryByName.get(normalized)
      if (existing) return existing

      try {
        const created = await db.createTaxonomyItem('category', name)
        if (created) {
          categoryByName.set(normalized, created)
          return created
        }
      } catch (error) {
        console.error('Failed to create category:', name, error)
      }
      return null
    }

    const ensureTheme = async (name: string): Promise<Theme | null> => {
      const normalized = normalizeName(name)
      const existing = themeByName.get(normalized)
      if (existing) return existing

      try {
        const created = await db.createTaxonomyItem('theme', name)
        if (created) {
          themeByName.set(normalized, created)
          return created
        }
      } catch (error) {
        console.error('Failed to create theme:', name, error)
      }
      return null
    }

    const ensureTag = async (name: string): Promise<Tag | null> => {
      const normalized = normalizeName(name)
      const existing = tagByName.get(normalized)
      if (existing) return existing

      try {
        const created = await db.createTaxonomyItem('tag', name)
        if (created) {
          tagByName.set(normalized, created)
          return created
        }
      } catch (error) {
        console.error('Failed to create tag:', name, error)
      }
      return null
    }

    const ensureAlliance = async (name: string): Promise<Alliance | null> => {
      const normalized = normalizeName(name)
      const existing = allianceByName.get(normalized)
      if (existing) return existing

      try {
        const created = await db.createTaxonomyItem('alliance', name)
        if (created) {
          allianceByName.set(normalized, created)
          return created
        }
      } catch (error) {
        console.error('Failed to create alliance:', name, error)
      }
      return null
    }

    const ensureCountry = async (
      name: string
    ): Promise<(Country & { cities: City[] }) | null> => {
      const normalized = normalizeName(name)
      const existing = countryByName.get(normalized)
      if (existing) return existing

      try {
        const created = await db.createTaxonomyItem('country', name)
        if (created) {
          const countryWithCities = { ...created, cities: [] }
          countryByName.set(normalized, countryWithCities)
          return countryWithCities
        }
      } catch (error) {
        console.error('Failed to create country:', name, error)
      }
      return null
    }

    const ensureCity = async (
      name: string,
      countryName: string
    ): Promise<City | null> => {
      const country = await ensureCountry(countryName)
      if (!country) return null

      const normalized = normalizeName(name)
      const existingCity = country.cities?.find(
        (c) => normalizeName(c.name) === normalized
      )
      if (existingCity) return existingCity

      try {
        const created = await db.createTaxonomyItem('city', name, {
          countryId: country.id,
        })
        if (created) {
          country.cities.push(created)
          return created
        }
      } catch (error) {
        console.error('Failed to create city:', name, error)
      }
      return null
    }

    if (
      Array.isArray(taxonomyData.category) ||
      taxonomyData.category !== undefined
    ) {
      const ids: number[] = []
      for (const name of categoryNames) {
        const category = await ensureCategory(name)
        if (category) {
          ids.push(category.id)
        }
      }
      taxonomyUpdatePayload.categoryIds = ids
    }

    if (
      Array.isArray(taxonomyData.theme) ||
      taxonomyData.theme !== undefined
    ) {
      const ids: number[] = []
      for (const name of themeNames) {
        const theme = await ensureTheme(name)
        if (theme) {
          ids.push(theme.id)
        }
      }
      taxonomyUpdatePayload.themeIds = ids
    }

    if (taxonomyData.tags !== undefined) {
      const ids: number[] = []
      for (const name of tagNames) {
        const tag = await ensureTag(name)
        if (tag) {
          ids.push(tag.id)
        }
      }
      taxonomyUpdatePayload.tagIds = ids
    }

    if (taxonomyData.alliances !== undefined) {
      const ids: number[] = []
      for (const name of allianceNames) {
        const alliance = await ensureAlliance(name)
        if (alliance) {
          ids.push(alliance.id)
        }
      }
      taxonomyUpdatePayload.allianceIds = ids
    }

    const countryIds: number[] = []
    const cityIds: number[] = []
    let shouldUpdateCountries = hasCountry
    let shouldUpdateCities = hasCity

    if (hasCountry) {
      if (countryName) {
        const country = await ensureCountry(countryName)
        if (country) {
          countryIds.push(country.id)
        }
      }
    }

    if (hasCity) {
      if (cityName) {
        let city: City | null = null

        if (countryName) {
          city = await ensureCity(cityName, countryName)
        } else {
          const normalizedCity = normalizeName(cityName)
          for (const country of taxonomy.countries) {
            const existingCity = (country.cities ?? []).find(
              (c) => normalizeName(c.name) === normalizedCity
            )
            if (existingCity) {
              city = existingCity
              if (!countryIds.includes(country.id)) {
                countryIds.push(country.id)
              }
              break
            }
          }

          if (!city) {
            console.warn(
              `City "${cityName}" cannot be resolved without country reference. Skipping.`
            )
          }
        }

        if (city) {
          if (!cityIds.includes(city.id)) {
            cityIds.push(city.id)
          }
          if (!countryIds.includes(city.countryId)) {
            countryIds.push(city.countryId)
          }
          shouldUpdateCountries = true
        }
      }
    }

    if (shouldUpdateCountries) {
      taxonomyUpdatePayload.countryIds = countryIds
    }

    if (shouldUpdateCities) {
      taxonomyUpdatePayload.cityIds = cityIds
    }

    const shouldUpdateTaxonomy =
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'countryIds') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'cityIds') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'themeIds') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'tagIds') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'categoryIds') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'allianceIds')

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
        return NextResponse.json(
          { success: false, error: 'Failed to update taxonomy' },
          { status: 500 }
        )
      }
    }

    const updatedMaterial = await db.getMaterialById(materialId)

    return NextResponse.json({
      success: true,
      data: {
        material: updatedMaterial,
        taxonomy: taxonomyUpdatePayload,
      },
    })
  } catch (error) {
    console.error('Error regenerating taxonomy:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to regenerate taxonomy' },
      { status: 500 }
    )
  }
}

