import { db } from '../db'
import { logSystemError } from '../logger'
import type { TelegramChannel } from '../types'
import { telegramParser } from './parser'
import { TelegramConfigError } from './client'

export interface TelegramSyncOptions {
  limit?: number
  lookbackHours?: number
  channel?: TelegramChannel
}

export interface TelegramSyncResult {
  fetched: number
  new: number
  updated: number
  errors: number
  channels?: number
  skipped?: boolean
  message?: string
}

const DEFAULT_LIMIT = Number(process.env.TELEGRAM_FETCH_LIMIT ?? '50')
const DEFAULT_LOOKBACK_HOURS = Number(process.env.TELEGRAM_LOOKBACK_HOURS ?? '48')

async function resolveLimitValue(input?: number): Promise<number> {
  if (input && input > 0) {
    return Math.min(input, 200)
  }

  if (process.env.TELEGRAM_FETCH_LIMIT) {
    const envLimit = Number(process.env.TELEGRAM_FETCH_LIMIT)
    if (Number.isFinite(envLimit) && envLimit > 0) {
      return Math.min(envLimit, 200)
    }
  }

  const stored = await db.getSetting('telegram_fetch_limit')
  const parsed = Number(stored)
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 200)
  }

  return DEFAULT_LIMIT
}

function resolveSinceDate(channel: TelegramChannel, lookbackHours: number): Date | null {
  if (channel.lastParsed) {
    return new Date(channel.lastParsed)
  }

  if (lookbackHours <= 0) {
    return null
  }

  const ms = lookbackHours * 60 * 60 * 1000
  return new Date(Date.now() - ms)
}

async function fetchChannel(channel: TelegramChannel, options: TelegramSyncOptions): Promise<TelegramSyncResult> {
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 200))
  const lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS
  const since = resolveSinceDate(channel, lookbackHours)

  try {
    const materials = await telegramParser.fetchChannelPosts(channel.username, {
      limit,
      since,
    })

    if (materials.length === 0) {
      await db.updateTelegramChannelLastParsed(channel.id)
      return { fetched: 0, new: 0, updated: 0, errors: 0, channels: 1 }
    }

    const stats = await db.saveMaterials(materials)
    await db.updateTelegramChannelLastParsed(channel.id)

    return {
      fetched: materials.length,
      new: stats.new,
      updated: stats.updated,
      errors: stats.errors,
      channels: 1,
    }
  } catch (error) {
    await logSystemError('telegram/fetch-channel', error, {
      channelId: channel.id,
      username: channel.username,
    })
    return {
      fetched: 0,
      new: 0,
      updated: 0,
      errors: 1,
      channels: 1,
      message: (error as Error)?.message,
    }
  }
}

export async function syncTelegramChannels(options?: TelegramSyncOptions): Promise<TelegramSyncResult> {
  const limit = await resolveLimitValue(options?.limit)
  const lookbackHours = options?.lookbackHours ?? DEFAULT_LOOKBACK_HOURS

  const channels = options?.channel
    ? [options.channel]
    : await db.getActiveTelegramChannels()

  if (channels.length === 0) {
    return { fetched: 0, new: 0, updated: 0, errors: 0, channels: 0 }
  }

  let aggregated: TelegramSyncResult = {
    fetched: 0,
    new: 0,
    updated: 0,
    errors: 0,
    channels: 0,
  }

  for (const channel of channels) {
    try {
      const result = await fetchChannel(channel, { limit, lookbackHours })
      aggregated = {
        fetched: aggregated.fetched + result.fetched,
        new: aggregated.new + result.new,
        updated: aggregated.updated + result.updated,
        errors: aggregated.errors + result.errors,
        channels: (aggregated.channels ?? 0) + (result.channels ?? 0),
      }
    } catch (error) {
      if (error instanceof TelegramConfigError) {
        return {
          fetched: aggregated.fetched,
          new: aggregated.new,
          updated: aggregated.updated,
          errors: aggregated.errors,
          channels: aggregated.channels,
          skipped: true,
          message: error.message,
        }
      }

      await logSystemError('telegram/sync', error, {
        username: channel.username,
      })
      aggregated.errors += 1
    }
  }

  return aggregated
}

