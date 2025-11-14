import type { Api } from 'telegram/tl'
import { getTelegramClient, TelegramConfigError } from './client'
import type { Material } from '../types'

export interface ValidateChannelResult {
  valid: boolean
  username?: string
  title?: string
  subscribers?: number
  error?: string
}

export interface FetchChannelOptions {
  limit?: number
  since?: Date | null
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase()
}

function buildMaterialId(username: string, messageId: number): string {
  return `telegram:${username}:${messageId}`
}

function renderFullContent(text: string | undefined): string {
  if (!text) {
    return ''
  }

  return text
    .split('\n')
    .map((line) => line.trim())
    .map((line) => (line.length === 0 ? '<br />' : `<p>${line}</p>`))
    .join('\n')
}

function extractTitle(text: string | undefined): string {
  if (!text) {
    return 'Публикация в Telegram'
  }

  const firstLine = text.trim().split('\n')[0]?.trim() ?? ''
  if (firstLine.length >= 16) {
    return firstLine.slice(0, 160)
  }

  const snippet = text.replace(/\s+/g, ' ').trim()
  return snippet.length > 0 ? snippet.slice(0, 160) : 'Публикация в Telegram'
}

function toIsoDate(value: any): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'number') {
    return new Date(value * 1000).toISOString()
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }
  return date.toISOString()
}

function messageToMaterial(username: string, message: any): Material {
  const messageText = message.message ?? ''
  const createdAt = toIsoDate(message.date)
  const link = `https://t.me/${username}/${message.id}`
  const contentText = messageText.trim().length > 0 ? messageText : 'Мультимедийный пост' // fallback

  return {
    id: buildMaterialId(username, message.id),
    title: extractTitle(messageText),
    content: contentText.slice(0, 1500),
    fullContent: renderFullContent(messageText),
    thumbnail: undefined,
    author: `@${username}`,
    createdAt,
    fetchedAt: new Date().toISOString(),
    link,
    source: `@${username}`,
    sourceType: 'telegram',
    telegramMessageId: String(message.id),
    status: 'new',
    processed: false,
    published: false,
  }
}

class TelegramParser {
  async validateChannel(username: string): Promise<ValidateChannelResult> {
    const normalized = normalizeUsername(username)
    if (!normalized) {
      return { valid: false, error: 'Укажите username канала' }
    }

    try {
      const client = await getTelegramClient()
      const entity = (await client.getEntity(normalized)) as Api.Channel

      if (!entity) {
        return { valid: false, error: 'Канал не найден' }
      }

      return {
        valid: true,
        username: normalized,
        title: entity.title ?? normalized,
        subscribers: Number((entity as any).participantsCount || entity.participantsCount) || undefined,
      }
    } catch (error) {
      if (error instanceof TelegramConfigError) {
        return { valid: false, error: error.message }
      }

      const message = (error as Error)?.message || 'Ошибка при проверке канала'

      if (message.includes('USERNAME_NOT_OCCUPIED')) {
        return { valid: false, error: 'Канал не существует' }
      }

      if (message.includes('CHANNEL_PRIVATE')) {
        return { valid: false, error: 'Канал приватный или недоступен' }
      }

      return { valid: false, error: message }
    }
  }

  async fetchChannelPosts(username: string, options?: FetchChannelOptions): Promise<Material[]> {
    const normalized = normalizeUsername(username)
    if (!normalized) {
      throw new Error('Не указан username канала')
    }

    const limit = Math.max(1, Math.min(options?.limit ?? 50, 200))
    const sinceDate = options?.since ?? null

    const client = await getTelegramClient()
    const materials: Material[] = []
    const iterator = client.iterMessages(normalized, {
      limit,
    })

    for await (const message of iterator) {
      if (!message || message.className !== 'Message') {
        continue
      }

      const typedMessage = message as any

      if (typedMessage.message?.trim().length === 0 && !typedMessage.media) {
        continue
      }

      if (sinceDate) {
        const messageDate = typedMessage.date ? new Date(typedMessage.date * 1000) : null
        if (messageDate && messageDate <= sinceDate) {
          break
        }
      }

      materials.push(messageToMaterial(normalized, typedMessage))
    }

    return materials
  }
}

export const telegramParser = new TelegramParser()

