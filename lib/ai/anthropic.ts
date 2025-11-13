import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'

export const CLAUDE_MODEL_PREFERENCE = [
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20240620',
  'claude-3-haiku-20240307',
]

type CallClaudeOptions = {
  maxTokens?: number
  temperature?: number
}

export async function callClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: CallClaudeOptions
): Promise<string> {
  const anthropic = new Anthropic({
    apiKey,
  })

  const requestedModel = model || CLAUDE_MODEL_PREFERENCE[0]
  const tried = new Set<string>()

  const candidates = [requestedModel, ...CLAUDE_MODEL_PREFERENCE].filter(
    (candidate) => {
      if (tried.has(candidate)) return false
      tried.add(candidate)
      return true
    }
  )

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
        message.content[0]?.type === 'text' ? message.content[0].text : ''

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


