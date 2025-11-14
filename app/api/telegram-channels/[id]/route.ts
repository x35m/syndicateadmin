import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'

interface RouteParams {
  params: {
    id: string
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const channelId = Number(params.id)
    if (Number.isNaN(channelId)) {
      return NextResponse.json({ success: false, error: 'Некорректный идентификатор' }, { status: 400 })
    }

    const payload = await request.json()
    const { title, description, subscribersCount, isActive } = payload ?? {}

    const updated = await db.updateTelegramChannel(channelId, {
      title,
      description,
      subscribersCount,
      isActive,
    })

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Канал не найден' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Канал обновлён',
    })
  } catch (error) {
    console.error('Error updating telegram channel:', error)
    await logSystemError('api/telegram-channels', error, { method: 'PATCH' })
    return NextResponse.json({ success: false, error: 'Не удалось обновить канал' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: RouteParams) {
  try {
    const channelId = Number(params.id)
    if (Number.isNaN(channelId)) {
      return NextResponse.json({ success: false, error: 'Некорректный идентификатор' }, { status: 400 })
    }

    const existing = await db.getTelegramChannelById(channelId)
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Канал не найден' }, { status: 404 })
    }

    await db.deleteTelegramChannel(channelId)

    return NextResponse.json({
      success: true,
      message: `Канал @${existing.username} удалён`,
    })
  } catch (error) {
    console.error('Error deleting telegram channel:', error)
    await logSystemError('api/telegram-channels', error, { method: 'DELETE' })
    return NextResponse.json({ success: false, error: 'Не удалось удалить канал' }, { status: 500 })
  }
}

