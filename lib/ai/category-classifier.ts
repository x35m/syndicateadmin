import type { Category } from '@/lib/types'
import { db } from '@/lib/db'
import JSON5 from 'json5'
import { jsonrepair } from 'jsonrepair'
import { callClaude } from './anthropic'

export const SUPER_CATEGORY_OPTIONS = [
  'Внутренняя Украина',
  'Международное',
  'Общее',
]

export type CategoryExample = {
  id: string
  title: string
  summary: string | null
  content: string | null
  category: string
}

export type CategoryChainReasoning = {
  step1_summary?: string
  step2_ukrainian_context?: string
  step3_keywords?: string[]
  step4_category?: string
  step5_reasoning?: string
  confidence?: number
}

export type CategoryClassificationResult = {
  category: string | null
  confidence: number
  reasoning: CategoryChainReasoning
  supercategory: string | null
  validationCategory?: string | null
  validationConfidence?: number
  validationComment?: string
}

export const parseJsonWithFallback = (payload: string) => {
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

export const clampConfidence = (value: unknown, fallback = 0.5) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  if (numeric < 0) return 0
  if (numeric > 1) return 1
  return numeric
}

const normalizeName = (value?: string | null) =>
  (value ?? '').normalize('NFKC').trim().toLowerCase()

const sanitizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

export const buildNegativeExamples = (categories: Category[]): string => {
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

export const buildCategoryExamples = (examples: CategoryExample[]): string => {
  if (examples.length === 0) {
    return 'Нет сохранённых примеров. Используй здравый смысл и чётко сопоставляй содержание статье с определённой категорией.'
  }

  return examples
    .map((example) => {
      const preview =
        sanitizeString(example.summary) ||
        sanitizeString(example.content)?.slice(0, 220) ||
        'нет краткого описания'
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

  const jsonPayload = parseJsonWithFallback(
    responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  ) as {
    supercategory?: string
    reasoning?: string
    confidence?: number
  }

  const supercategory = sanitizeString(jsonPayload.supercategory)
  const normalized =
    SUPER_CATEGORY_OPTIONS.find(
      (option) => normalizeName(option) === normalizeName(supercategory)
    ) ?? null

  return {
    supercategory: normalized,
    reasoning: sanitizeString(jsonPayload.reasoning),
    confidence: clampConfidence(jsonPayload.confidence, 0.6),
  } as SupercategoryResult
}

const classifyExactCategory = async (args: {
  apiKey: string
  model: string
  articleText: string
  categories: Category[]
  examples: CategoryExample[]
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

  const parsed = parseJsonWithFallback(
    responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  ) as CategoryChainReasoning

  const categoryName = sanitizeString(parsed.step4_category)
  const confidence = clampConfidence(parsed.confidence, 0.6)

  return {
    category: categoryName || null,
    confidence,
    reasoning: parsed,
  }
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

  const parsed = parseJsonWithFallback(
    responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  ) as {
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

export const runCategoryClassification = async (args: {
  materialId: string
  articleText: string
  materialTitle?: string
  categories: Category[]
  examples: CategoryExample[]
  claudeApiKey?: string | null
  claudeModel: string
}): Promise<CategoryClassificationResult | null> => {
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
      supercategory: supercategoryResult.supercategory ?? null,
      validationCategory,
      validationConfidence,
      validationComment,
    }
  } catch (error) {
    console.error('Advanced category classification failed:', error)
    await db.createCategorizationLog({
      materialId,
      predictedCategory: undefined,
      confidence: 0,
      reasoning: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
    return null
  }
}


