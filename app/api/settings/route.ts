import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const geminiApiKey = await db.getSetting('gemini_api_key')
    const summaryPrompt = await db.getSetting('summary_prompt')
    const taxonomySystemPrompt = await db.getSetting('taxonomy_system_prompt')
    const taxonomyFormatPrompt = await db.getSetting('taxonomy_format_prompt')

    const defaultSummaryPrompt =
      'Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).'
    const defaultTaxonomySystemPrompt =
      'Ты — редактор аналитического портала. Определи страну, город, темы и теги статьи так, чтобы они помогали редакции быстро рубрицировать материалы.'
    const defaultTaxonomyFormatPrompt =
      'Верни ответ строго в формате JSON:\n{\n  "summary": "краткое резюме на русском",\n  "taxonomy": {\n    "country": "Название страны или null",\n    "city": "Название города или null",\n    "themes": ["Список тем"],\n    "tags": ["Список тегов"]\n  }\n}\nНе добавляй пояснений. Если не удалось определить значение, используй null или пустой массив.'

    return NextResponse.json({
      success: true,
      data: {
        geminiApiKey: geminiApiKey || '',
        summaryPrompt: summaryPrompt || defaultSummaryPrompt,
        taxonomySystemPrompt: taxonomySystemPrompt || defaultTaxonomySystemPrompt,
        taxonomyFormatPrompt: taxonomyFormatPrompt || defaultTaxonomyFormatPrompt,
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
    const { geminiApiKey, summaryPrompt, taxonomySystemPrompt, taxonomyFormatPrompt } = body

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

    if (taxonomySystemPrompt) {
      await db.setSetting('taxonomy_system_prompt', taxonomySystemPrompt)
    }

    if (taxonomyFormatPrompt) {
      await db.setSetting('taxonomy_format_prompt', taxonomyFormatPrompt)
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

