import type { City, Country } from '@/lib/types'
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
  countries: Array<Country & { cities: City[] }>
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

  return [
    'Страны и города: ' + countryLines.join(' | '),
    'Если подходящего значения нет, предложи новое аккуратное название.',
  ].join('\n')
}

const DEFAULT_TAXONOMY_FORMAT_PROMPT = `Верни только JSON объект со следующей структурой:
{
  "country": "название страны" или null,
  "city": "название города" или null
}`

const DEFAULT_TAXONOMY_PROMPTS = {
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
    const taxonomyContext = buildTaxonomyContext(taxonomy.countries)

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
      country?: string | null
      city?: string | null
    }

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
      countryIds?: number[]
      cityIds?: number[]
    } = {}

    const countryByName = new Map<string, Country & { cities: City[] }>()
    for (const country of taxonomy.countries) {
      countryByName.set(normalizeName(country.name), {
        ...country,
        cities: country.cities ?? [],
      })
    }

    const countryIds: number[] = []
    const cityIds: number[] = []
    let shouldUpdateCountries = hasCountry
    let shouldUpdateCities = hasCity

    const ensureCountry = async (
      name: string
    ): Promise<(Country & { cities: City[] }) | null> => {
      const key = normalizeName(name)
      if (key.length === 0) return null
      const existing = countryByName.get(key)
      if (existing) return existing

      try {
        const created = await db.createTaxonomyItem('country', name)
        if (created) {
          const enriched = { ...created, cities: [] as City[] }
          countryByName.set(key, enriched)
          taxonomy.countries.push(enriched)
          return enriched
        }
      } catch (error) {
        console.error('Failed to create country:', name, error)
      }
      return null
    }

    const cityByName = new Map<string, Array<City>>()
    for (const country of taxonomy.countries) {
      for (const city of country.cities ?? []) {
        const key = normalizeName(city.name)
        if (!cityByName.has(key)) {
          cityByName.set(key, [])
        }
        cityByName.get(key)!.push(city)
      }
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

      const parentCountry = taxonomy.countries.find(
        (country) => country.id === countryIdHint
      )
      if (parentCountry) {
        parentCountry.cities = [...(parentCountry.cities ?? []), enriched]
      }

      return enriched
    }

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
          const countryIdHint = countryIds[0] ?? null
          city = await ensureCity(cityName, countryIdHint)
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

