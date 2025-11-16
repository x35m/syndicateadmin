import { NextResponse } from 'next/server'
import { resetTelegramClient } from '@/lib/telegram/client'
import { logSystemError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await resetTelegramClient()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting Telegram client:', error)
    await logSystemError('api/telegram/reset', error, { method: 'POST' })
    return NextResponse.json(
      { success: false, error: 'Failed to reset Telegram client' },
      { status: 500 }
    )
  }
}


