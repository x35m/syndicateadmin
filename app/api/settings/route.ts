import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const geminiApiKey = await db.getSetting('gemini_api_key')
    const summaryPrompt = await db.getSetting('summary_prompt')

    return NextResponse.json({
      success: true,
      data: {
        geminiApiKey: geminiApiKey || '',
        summaryPrompt: summaryPrompt || 'Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).',
      },
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { geminiApiKey, summaryPrompt } = body

    if (!geminiApiKey) {
      return NextResponse.json(
        { success: false, error: 'API ключ обязателен' },
        { status: 400 }
      )
    }

    await db.setSetting('gemini_api_key', geminiApiKey)
    
    if (summaryPrompt) {
      await db.setSetting('summary_prompt', summaryPrompt)
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}

