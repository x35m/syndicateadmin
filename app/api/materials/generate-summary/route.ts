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
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20240620',
  'claude-3-haiku-20240307',
]

async function callClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    maxTokens?: number
    temperature?: number
  }
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
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature,
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

const SUPER_CATEGORY_OPTIONS = [
  'Внутренняя Украина',
  'Международное',
  'Общее',
]

const parseJsonWithFallback = (payload: string) => {
  try {
    return JSON.parse(payload)
  } catch (firstError) {
    let secondError: unknown = null
    try {
      return JSON5.parse(payload)
    } catch (json5Error) {
      secondError = json5Error
      try {
        const repaired = jsonrepair(payload)
        return JSON.parse(repaired)
      } catch (repairError) {
        throw new Error(
          `Failed to parse JSON. First error: ${(firstError as Error).message}. ` +
            `JSON5 error: ${
              secondError instanceof Error ? secondError.message : secondError
            }. Repair error: ${
              repairError instanceof Error ? repairError.message : repairError
            }`
        )
      }
    }
  }
}

const clampConfidence = (value: unknown, fallback = 0.5) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  if (numeric < 0) return 0
  if (numeric > 1) return 1
  return numeric
}

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

const buildNegativeExamples = (categories: Category[]): string => {
  if (categories.length === 0) {
    return 'Нет сохранённых категорий. Если создаёшь новую категорию, убедись, что она отличается от существующих и не дублирует темы других рубрик.'
  }

  return categories.slice(0, 12).map((category) => {
    return [
      `Категория "${category.name}":`,
      '✅ ОТНОСИТСЯ: Материал, где эта тема является основной, и большинство ключевых фактов напрямую описывают именно её.',
      '❌ НЕ ОТНОСИТСЯ: Если категория упомянута лишь вскользь или как фон, а основная тема относится к другой рубрике.',
      '❌ НЕ ОТНОСИТСЯ: Если материал относится к другой специализации (например, военные действия, экономика, культура).',
    ].join('\n')
  }).join('\n\n')
}

const buildCategoryExamples = (
  examples: Array<{
    id: string
    title: string
    summary: string | null
    content: string | null
    category: string
  }>
): string => {
  if (examples.length === 0) {
    return 'Нет сохранённых примеров. Используй здравый смысл и чётко сопоставляй содержание статье с определённой категорией.'
  }

  return examples
    .map((example) => {
      const preview = sanitizeString(example.summary) || sanitizeString(example.content)?.slice(0, 220) || 'нет краткого описания'
      return [
        `Заголовок: ${example.title}`,
        `Категория: ${example.category}`,
        `Краткое описание: ${preview}`,
      ].join('\n')
    })
    .join('\n\n')
}

type SupercategoryResult = {
  supercategory: string | null
  reasoning: string | null
  confidence: number
}

type CategoryChainReasoning = {
  step1_summary?: string
  step2_ukrainian_context?: string
  step3_keywords?: string[]
  step4_category?: string
  step5_reasoning?: string
  confidence?: number
}

type ClassificationResult = {
  category: string | null
  confidence: number
  reasoning: CategoryChainReasoning
}

const classifySupercategory = async (args: {
  apiKey: string
  model: string
  articleText: string
  materialTitle?: string
}) => {
  const { apiKey, model, articleText, materialTitle } = args

  const systemPrompt = [
    'Ты — аналитик новостного портала. Твоя задача — определить надкатегорию материала для дальнейшей точной классификации.',
    'Возможные надкатегории:',
    '- "Внутренняя Украина" — события внутри страны, управление, экономика, общество.',
    '- "Международное" — внешняя политика, международные отношения, глобальные события, влияющие на Украину.',
    '- "Общее" — материалы общего характера, которые не попадают в первые два типа (например, технологии, культура глобально).',
    'Всегда возвращай JSON с ключами: supercategory, reasoning, confidence (0..1).',
  ].join('\n')

  const userPrompt = [
    materialTitle ? `Заголовок: ${materialTitle}` : null,
    'Текст статьи:',
    articleText,
    'Определи надкатегорию (только из списка).',
    'Верни JSON формата:',
    `{
  "supercategory": "Внутренняя Украина | Международное | Общее",
  "reasoning": "почему выбран этот вариант",
  "confidence": 0.82
}`,
    'Только чистый JSON.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const responseText = await callClaude(apiKey, model, systemPrompt, userPrompt, {
    maxTokens: 512,
    temperature: 0.2,
  })

  const jsonPayload = extractJsonFromText(responseText) ?? responseText
  const parsed = parseJsonWithFallback(jsonPayload) as {
    supercategory?: string
    reasoning?: string
    confidence?: number
  }

  const supercategory = sanitizeString(parsed.supercategory)
  const normalized =
    SUPER_CATEGORY_OPTIONS.find(
      (option) => normalizeName(option) === normalizeName(supercategory)
    ) ?? null

  return {
    supercategory: normalized,
    reasoning: sanitizeString(parsed.reasoning),
    confidence: clampConfidence(parsed.confidence, 0.6),
  } as SupercategoryResult
}

const classifyExactCategory = async (args: {
  apiKey: string
  model: string
  articleText: string
  categories: Category[]
  examples: Array<{
    id: string
    title: string
    summary: string | null
    content: string | null
    category: string
  }>
  supercategory?: string | null
  materialTitle?: string
}) => {
  const {
    apiKey,
    model,
    articleText,
    categories,
    examples,
    supercategory,
    materialTitle,
  } = args

  const guidelines = buildNegativeExamples(categories)
  const exampleBlock = buildCategoryExamples(examples)

  const orderedCategories =
    categories.length > 0
      ? categories
          .map((category) => category.name)
          .sort((a, b) => a.localeCompare(b, 'ru'))
      : ['(Категории не заданы — при необходимости предложи новую формулировку)']

  const systemSections = [
    'Ты — опытный редактор по классификации материалов.',
    'Список доступных категорий (используй точное написание):',
    orderedCategories.map((name) => `- ${name}`).join('\n'),
    'Как отличать категории: ',
    guidelines,
    'Примеры из архива (ориентируйся на стиль и тематику):',
    exampleBlock,
    'Если нет точного соответствия, предложи новую категорию, но поясни, чем она отличается.',
  ]

  const systemPrompt = systemSections.filter(Boolean).join('\n\n')

  const userPromptParts = [
    materialTitle ? `Заголовок: ${materialTitle}` : null,
    supercategory
      ? `Определённая надкатегория: ${supercategory}. Убедись, что финальная категория совместима с этой надкатегорией.`
      : 'Надкатегорию определить не удалось — выбери наиболее подходящую категорию.',
    'Проанализируй статью и определи категорию. Используй пошаговый анализ.',
    'СТАТЬЯ:',
    articleText,
    'ПОШАГОВЫЙ АНАЛИЗ:',
    'Шаг 1: О чем статья одним предложением?',
    'Шаг 2: Есть ли украинский контекст? (да/нет и почему)',
    'Шаг 3: Какие ключевые слова присутствуют?',
    'Шаг 4: К какой категории относится?',
    'Шаг 5: Почему именно эта категория, а не другие похожие?',
    'Верни JSON:',
    `{
  "step1_summary": "...",
  "step2_ukrainian_context": "да/нет, потому что...",
  "step3_keywords": ["слово1", "слово2"],
  "step4_category": "Название категории",
  "step5_reasoning": "Объяснение выбора и почему не другие категории",
  "confidence": 0.95
}`,
    'Только чистый JSON без markdown.',
  ]

  const userPrompt = userPromptParts.filter(Boolean).join('\n\n')

  const responseText = await callClaude(apiKey, model, systemPrompt, userPrompt, {
    maxTokens: 1024,
    temperature: 0.3,
  })

  const jsonPayload = extractJsonFromText(responseText) ?? responseText
  const parsed = parseJsonWithFallback(jsonPayload) as CategoryChainReasoning

  const categoryName = sanitizeString(parsed.step4_category)
  const confidence = clampConfidence(parsed.confidence, 0.6)

  return {
    category: categoryName || null,
    confidence,
    reasoning: parsed,
  } as ClassificationResult
}

const validateCategory = async (args: {
  apiKey: string
  model: string
  articleText: string
  proposedCategory: string | null
  supercategory?: string | null
  materialTitle?: string
}) => {
  const { apiKey, model, articleText, proposedCategory, supercategory, materialTitle } = args

  const systemPrompt = [
    'Ты — редактор, который перепроверяет корректность выбранной категории.',
    'Если категория не подходит, предложи альтернативу и объясни расхождение.',
  ].join('\n')

  const userPrompt = [
    materialTitle ? `Заголовок: ${materialTitle}` : null,
    `Предложенная категория: ${proposedCategory || 'не указана'}`,
    supercategory ? `Надкатегория: ${supercategory}` : null,
    'ПРОЧИТАЙ СТАТЬЮ:',
    articleText,
    'Верни JSON:',
    `{
  "category": "Название категории или предыдущая, если согласен",
  "confidence": 0.8,
  "comment": "пояснение оценки"
}`,
    'Только чистый JSON.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const responseText = await callClaude(apiKey, model, systemPrompt, userPrompt, {
    maxTokens: 512,
    temperature: 0.2,
  })

  const payload = extractJsonFromText(responseText) ?? responseText
  const parsed = parseJsonWithFallback(payload) as {
    category?: string
    confidence?: number
    comment?: string
  }

  return {
    category: sanitizeString(parsed.category) || proposedCategory || null,
    confidence: clampConfidence(parsed.confidence, 0.5),
    comment: sanitizeString(parsed.comment),
  }
}

const runCategoryClassification = async (args: {
  materialId: string
  articleText: string
  materialTitle?: string
  categories: Category[]
  examples: Array<{
    id: string
    title: string
    summary: string | null
    content: string | null
    category: string
  }>
  claudeApiKey?: string | null
  claudeModel: string
}) => {
  const {
    materialId,
    articleText,
    materialTitle,
    categories,
    examples,
    claudeApiKey,
    claudeModel,
  } = args

  if (!claudeApiKey) {
    return null
  }

  try {
    const supercategoryResult = await classifySupercategory({
      apiKey: claudeApiKey,
      model: claudeModel,
      articleText,
      materialTitle,
    })

    const exactResult = await classifyExactCategory({
      apiKey: claudeApiKey,
      model: claudeModel,
      articleText,
      categories,
      examples,
      supercategory: supercategoryResult.supercategory,
      materialTitle,
    })

    let finalCategory = exactResult.category
    let finalConfidence = exactResult.confidence
    let validationCategory: string | null = null
    let validationConfidence: number | undefined
    let validationComment: string | undefined

    if (exactResult.confidence < 0.75) {
      const validation = await validateCategory({
        apiKey: claudeApiKey,
        model: claudeModel,
        articleText,
        proposedCategory: finalCategory,
        supercategory: supercategoryResult.supercategory,
        materialTitle,
      })

      validationCategory = validation.category
      validationConfidence = validation.confidence
      validationComment = validation.comment

      if (
        validation.category &&
        normalizeName(validation.category) !== normalizeName(finalCategory || '')
      ) {
        finalCategory = validation.category
        finalConfidence = Math.max(validation.confidence, finalConfidence * 0.9)
      } else if (validation.confidence > finalConfidence) {
        finalConfidence = validation.confidence
      }
    }

    await db.createCategorizationLog({
      materialId,
      supercategory: supercategoryResult.supercategory ?? undefined,
      predictedCategory: exactResult.category ?? undefined,
      validationCategory: validationCategory ?? undefined,
      confidence: exactResult.confidence,
      validationConfidence,
      reasoning: {
        supercategory_reasoning: supercategoryResult.reasoning,
        classification: exactResult.reasoning,
        validation_comment: validationComment,
      },
      metadata: {
        final_category: finalCategory,
        final_confidence: finalConfidence,
      },
    })

    return {
      category: finalCategory,
      confidence: finalConfidence,
      reasoning: exactResult.reasoning,
      supercategory: supercategoryResult.supercategory,
    }
  } catch (error) {
    console.error('Advanced category classification failed:', error)
    await db.createCategorizationLog({
      materialId,
      predictedCategory: null,
      confidence: 0,
      reasoning: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
    return null
  }
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
    const claudeModel = settings['claude_model'] || 'claude-sonnet-4-20250514'
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

    const hasCategoriesInResponse = Object.prototype.hasOwnProperty.call(
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

    const rawCategoryNames: string[] = []

    if (advancedCategoryResult?.category) {
      rawCategoryNames.push(advancedCategoryResult.category)
    } else if (hasCategoriesInResponse) {
      if (Array.isArray(taxonomyResult.categories)) {
        rawCategoryNames.push(...taxonomyResult.categories)
      }
    }

    const categoryNames = rawCategoryNames
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
    let shouldUpdateCategories = categoryNames.length > 0
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
    console.error('Error generating summary and taxonomy:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

