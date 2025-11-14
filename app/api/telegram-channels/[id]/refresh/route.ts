import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'
import { syncTelegramChannels } from '@/lib/telegram/service'

interface RouteParams {
  params: {
    id: string
  }
}

export async function POST(_: Request, { params }: RouteParams) {
  try {
    const channelId = Number(params.id)
    if (Number.isNaN(channelId)) {
      return NextResponse.json({ success: false, error: 'Некорректный идентификатор' }, { status: 400 })
    }

    const channel = await db.getTelegramChannelById(channelId)
    if (!channel) {
      return NextResponse.json({ success: false, error: 'Канал не найден' }, { status: 404 })
    }

    const result = await syncTelegramChannels({ channel })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Обновление канала @${channel.username} завершено`,
    })
  } catch (error) {
    console.error('Error refreshing telegram channel:', error)
    await logSystemError('api/telegram-channels/refresh', error, { id: params.id })
    return NextResponse.json({ success: false, error: 'Не удалось обновить канал' }, { status: 500 })
  }
}

