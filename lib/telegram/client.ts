import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { db } from '../db'

export class TelegramConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TelegramConfigError'
  }
}

interface TelegramCredentials {
  apiId: number
  apiHash: string
  session: string
}

const CREDS_TTL_MS = 5 * 60 * 1000

let cachedCredentials: TelegramCredentials | null = null
let cachedAt = 0
let clientInstance: TelegramClient | null = null
let clientPromise: Promise<TelegramClient> | null = null

async function resolveCredentialFromSettings(key: string): Promise<string | null> {
  return process.env[key.toUpperCase()] ?? (await db.getSetting(key))
}

async function loadCredentials(force = false): Promise<TelegramCredentials> {
  if (!force && cachedCredentials && Date.now() - cachedAt < CREDS_TTL_MS) {
    return cachedCredentials
  }

  const [apiIdRaw, apiHashRaw, sessionRaw] = await Promise.all([
    resolveCredentialFromSettings('telegram_api_id'),
    resolveCredentialFromSettings('telegram_api_hash'),
    resolveCredentialFromSettings('telegram_session'),
  ])

  const apiIdValue = apiIdRaw || process.env.TELEGRAM_API_ID
  const apiHashValue = apiHashRaw || process.env.TELEGRAM_API_HASH
  const sessionValue = sessionRaw || process.env.TELEGRAM_SESSION

  if (!apiIdValue || !apiHashValue) {
    throw new TelegramConfigError('Telegram API ID и API Hash не настроены')
  }

  const apiId = Number(apiIdValue)
  if (Number.isNaN(apiId) || apiId <= 0) {
    throw new TelegramConfigError('Telegram API ID должен быть положительным числом')
  }

  if (!sessionValue || sessionValue.trim().length === 0) {
    throw new TelegramConfigError('Telegram session отсутствует. Сгенерируйте TELEGRAM_SESSION и сохраните его в настройках.')
  }

  cachedCredentials = {
    apiId,
    apiHash: apiHashValue,
    session: sessionValue.trim(),
  }
  cachedAt = Date.now()
  return cachedCredentials
}

async function initializeClient(force = false): Promise<TelegramClient> {
  if (typeof window !== 'undefined') {
    throw new Error('Telegram client доступен только на сервере')
  }

  if (!force && clientInstance) {
    return clientInstance
  }

  const credentials = await loadCredentials(force)
  const session = new StringSession(credentials.session)
  const client = new TelegramClient(session, credentials.apiId, credentials.apiHash, {
    connectionRetries: 5,
  })

  await client.connect()

  try {
    await client.getMe()
  } catch (error) {
    await client.disconnect()
    throw new TelegramConfigError(
      'Telegram session недействительна. Перегенерируйте TELEGRAM_SESSION через scripts/telegram-auth.'
    )
  }

  clientInstance = client
  return clientInstance
}

export async function getTelegramClient(): Promise<TelegramClient> {
  if (!clientPromise) {
    clientPromise = initializeClient().catch((error) => {
      clientPromise = null
      clientInstance = null
      throw error
    })
  }
  return clientPromise
}

export async function resetTelegramClient(): Promise<void> {
  cachedCredentials = null
  cachedAt = 0

  if (clientInstance) {
    try {
      await clientInstance.disconnect()
    } catch {
      // ignore disconnect errors
    }
  }

  clientInstance = null
  clientPromise = null
}

export async function ensureTelegramConfigured(): Promise<{ ready: boolean; reason?: string }> {
  try {
    await loadCredentials()
    return { ready: true }
  } catch (error) {
    if (error instanceof TelegramConfigError) {
      return { ready: false, reason: error.message }
    }
    throw error
  }
}

