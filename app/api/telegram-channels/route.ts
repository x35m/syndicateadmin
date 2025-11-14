import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'
import { telegramParser } from '@/lib/telegram/parser'
import { ensureTelegramConfigured } from '@/lib/telegram/client'

export async function GET() {
  try {
    const [channels, configStatus] = await Promise.all([
      db.getAllTelegramChannels(),
      ensureTelegramConfigured(),
    ])

    return NextResponse.json({
      success: true,
      data: channels,
      meta: {
        telegramConfigured: configStatus.ready,
        message: configStatus.reason,
      },
    })
  } catch (error) {
    console.error('Error fetching telegram channels:', error)
    await logSystemError('api/telegram-channels', error, { method: 'GET' })
    return NextResponse.json(
      { success: false, error: 'Не удалось получить список каналов' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const usernameRaw = (body?.username ?? '') as string
    const username = usernameRaw.trim()

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Укажите username канала' },
        { status: 400 }
      )
    }

    const normalizedUsername = username.replace(/^@+/, '').toLowerCase()

    const existing = await db.getTelegramChannelByUsername(normalizedUsername)
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Канал @${normalizedUsername} уже добавлен` },
        { status: 409 }
      )
    }

    const validation = await telegramParser.validateChannel(normalizedUsername)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Не удалось проверить канал' },
        { status: 400 }
      )
    }

    const channel = await db.addTelegramChannel({
      username: validation.username ?? normalizedUsername,
      title: validation.title ?? username,
      subscribersCount: validation.subscribers,
      isActive: true,
    })

    return NextResponse.json({
      success: true,
      data: channel,
      message: `Канал @${channel.username} добавлен`,
    })
  } catch (error) {
    console.error('Error adding telegram channel:', error)
    await logSystemError('api/telegram-channels', error, { method: 'POST' })
    return NextResponse.json(
      { success: false, error: 'Не удалось добавить канал' },
      { status: 500 }
    )
  }
}

