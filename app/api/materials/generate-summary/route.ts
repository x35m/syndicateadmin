import type { City, Country, Tag, Theme } from '@/lib/types'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DEFAULT_SUMMARY_PROMPT =
  'Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).'
const DEFAULT_TAXONOMY_SYSTEM_PROMPT =
  'Ты — редактор аналитического портала. Определи страну, город, темы и теги статьи так, чтобы они помогали редакции быстро рубрицировать материалы.'
const DEFAULT_TAXONOMY_FORMAT_PROMPT =
  'Верни ответ строго в формате JSON:\n{\n  "summary": "краткое резюме на русском",\n  "taxonomy": {\n    "country": "Название страны или null",\n    "city": "Название города или null",\n    "themes": ["Список тем"],\n    "tags": ["Список тегов"]\n  }\n}\nНе добавляй пояснений. Если не удалось определить значение, используй null или пустой массив.'

const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_CONTENT_LENGTH = 15000

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
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

const buildTaxonomyContext = (
  countries: Array<Country & { cities: City[] }>,
  themes: Theme[],
  tags: Tag[]
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

  return [
    'Страны и города: ' + countryLines.join(' | '),
    'Темы: ' + themeLine,
    'Теги: ' + tagLine,
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

    const geminiApiKey = await db.getSetting('gemini_api_key')
    const summaryPrompt = await db.getSetting('summary_prompt')
    const taxonomySystemPrompt = await db.getSetting('taxonomy_system_prompt')
    const taxonomyFormatPrompt = await db.getSetting('taxonomy_format_prompt')

    if (!geminiApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini API ключ не настроен. Перейдите в Настройки.',
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

    const taxonomyData = await db.getTaxonomy()

    const promptSections = [
      'Задача: создай краткое саммари и предложи таксономию для статьи.',
      summaryPrompt || DEFAULT_SUMMARY_PROMPT,
      taxonomySystemPrompt || DEFAULT_TAXONOMY_SYSTEM_PROMPT,
      taxonomyFormatPrompt || DEFAULT_TAXONOMY_FORMAT_PROMPT,
      'Вот доступные справочники для ориентира:',
      buildTaxonomyContext(
        taxonomyData.countries,
        taxonomyData.themes,
        taxonomyData.tags
      ),
      'Статья:',
      contentToAnalyze,
    ]

    const prompt = promptSections.filter(Boolean).join('\n\n')

    console.log(
      `Generating summary & taxonomy for material ${materialId}. Content length: ${contentToAnalyze.length}`
    )

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    }

    console.log(
      'Gemini request (truncated):',
      JSON.stringify(requestBody).substring(0, 400) + '...'
    )

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error(
        'Gemini API error:',
        geminiResponse.status,
        errorText.slice(0, 500)
      )

      let errorMessage = 'Ошибка при обращении к Gemini API'
      let userFriendlyMessage = errorMessage

      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorMessage

        if (errorMessage.includes('internal error')) {
          userFriendlyMessage =
            'Временная ошибка Gemini API. Попробуйте через несколько секунд.'
        } else if (errorMessage.includes('API key')) {
          userFriendlyMessage = 'Проблема с API ключом. Проверьте настройки.'
        } else if (
          errorMessage.includes('quota') ||
          errorMessage.includes('limit')
        ) {
          userFriendlyMessage =
            'Превышен лимит запросов. Подождите немного и повторите попытку.'
        } else if (errorMessage.includes('SAFETY')) {
          userFriendlyMessage =
            'Контент заблокирован фильтром безопасности Gemini.'
        } else {
          userFriendlyMessage = errorMessage
        }
      } catch (parseError) {
        console.error('Failed to parse Gemini error payload:', parseError)
      }

      return NextResponse.json(
        { success: false, error: userFriendlyMessage, details: errorMessage },
        { status: geminiResponse.status }
      )
    }

    const geminiData = await geminiResponse.json()
    const textResponse =
      geminiData.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? '')
        .join('')
        .trim() ?? ''

    console.log(
      'Gemini response (truncated):',
      textResponse.slice(0, 500) + (textResponse.length > 500 ? '...' : '')
    )

    const jsonPayload = extractJsonFromText(textResponse)

    if (!jsonPayload) {
      console.error('Gemini response is not valid JSON. Full text:', textResponse)
      return NextResponse.json(
        {
          success: false,
          error:
            'Нейросеть вернула ответ в неожиданном формате. Уточните промпт для JSON.',
        },
        { status: 500 }
      )
    }

    let parsedResponse: {
      summary?: string
      taxonomy?: {
        country?: string | null
        city?: string | null
        themes?: unknown
        tags?: unknown
      }
    }

    try {
      parsedResponse = JSON.parse(jsonPayload)
    } catch (parseError) {
      console.error('Failed to parse JSON from Gemini:', parseError, jsonPayload)
      return NextResponse.json(
        {
          success: false,
          error:
            'Не удалось разобрать JSON от нейросети. Проверьте формат ответа.',
        },
        { status: 500 }
      )
    }

    const summary = sanitizeString(parsedResponse.summary)

    if (!summary) {
      console.error('Summary is missing in parsed response:', parsedResponse)
      return NextResponse.json(
        {
          success: false,
          error:
            'Нейросеть не вернула саммари. Уточните промпт или повторите попытку.',
        },
        { status: 500 }
      )
    }

    const taxonomyResult = parsedResponse.taxonomy ?? {}

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

    const themeNames = sanitizeStringArray(taxonomyResult.themes)
    const tagNames = sanitizeStringArray(taxonomyResult.tags)

    const countryByName = new Map<
      string,
      (typeof taxonomyData.countries)[number]
    >()
    const cityByName = new Map<string, Array<City>>()
    const themeByName = new Map<string, Theme>()
    const tagByName = new Map<string, Tag>()

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

    taxonomyData.themes.forEach((theme) => {
      themeByName.set(normalizeName(theme.name), theme)
    })

    taxonomyData.tags.forEach((tag) => {
      tagByName.set(normalizeName(tag.name), tag)
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

      let city = candidates.find((item) =>
        countryIdHint ? item.countryId === countryIdHint : true
      )

      if (city) {
        return city
      }

      if (!countryIdHint) {
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
      }

      return enriched
    }

    const ensureTheme = async (name: string) => {
      const key = normalizeName(name)
      if (key.length === 0) return null
      const existing = themeByName.get(key)
      if (existing) return existing

      const created = await db.createTaxonomyItem('theme', name)
      themeByName.set(key, created)
      taxonomyData.themes.push(created)
      return created
    }

    const ensureTag = async (name: string) => {
      const key = normalizeName(name)
      if (key.length === 0) return null
      const existing = tagByName.get(key)
      if (existing) return existing

      const created = await db.createTaxonomyItem('tag', name)
      tagByName.set(key, created)
      taxonomyData.tags.push(created)
      return created
    }

    const taxonomyUpdatePayload: {
      countryId?: number | null
      cityId?: number | null
      themeIds?: number[]
      tagIds?: number[]
    } = {}

    if (hasCountry) {
      if (countryName) {
        try {
          const country = await ensureCountry(countryName)
          taxonomyUpdatePayload.countryId = country?.id ?? null
        } catch (error) {
          console.error('Failed to ensure country:', countryName, error)
          taxonomyUpdatePayload.countryId = null
        }
      } else {
        taxonomyUpdatePayload.countryId = null
      }
    }

    if (hasCity) {
      if (cityName) {
        try {
          const city = await ensureCity(
            cityName,
            taxonomyUpdatePayload.countryId
          )
          if (city) {
            taxonomyUpdatePayload.cityId = city.id

            if (
              taxonomyUpdatePayload.countryId === undefined ||
              taxonomyUpdatePayload.countryId === null
            ) {
              taxonomyUpdatePayload.countryId = city.countryId
            }
          } else {
            taxonomyUpdatePayload.cityId = null
          }
        } catch (error) {
          console.error('Failed to ensure city:', cityName, error)
          taxonomyUpdatePayload.cityId = null
        }
      } else {
        taxonomyUpdatePayload.cityId = null
      }
    }

    if (Array.isArray(taxonomyResult.themes)) {
      const ids: number[] = []
      for (const themeName of themeNames) {
        try {
          const theme = await ensureTheme(themeName)
          if (theme) {
            ids.push(theme.id)
          }
        } catch (error) {
          console.error('Failed to ensure theme:', themeName, error)
        }
      }
      taxonomyUpdatePayload.themeIds = ids
    }

    if (Array.isArray(taxonomyResult.tags)) {
      const ids: number[] = []
      for (const tagName of tagNames) {
        try {
          const tag = await ensureTag(tagName)
          if (tag) {
            ids.push(tag.id)
          }
        } catch (error) {
          console.error('Failed to ensure tag:', tagName, error)
        }
      }
      taxonomyUpdatePayload.tagIds = ids
    }

    await db.updateMaterialSummary(materialId, summary)

    const shouldUpdateTaxonomy =
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'countryId') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'cityId') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'themeIds') ||
      Object.prototype.hasOwnProperty.call(taxonomyUpdatePayload, 'tagIds')

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

