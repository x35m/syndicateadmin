import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const geminiApiKey = await db.getSetting('gemini_api_key')
    const claudeApiKey = await db.getSetting('claude_api_key')
    const aiProvider = await db.getSetting('ai_provider') || 'gemini'
    const analysisPrompt = await db.getSetting('analysis_prompt')
    const summaryPrompt = await db.getSetting('summary_prompt')
    const taxonomySystemPrompt = await db.getSetting('taxonomy_system_prompt')
    const taxonomyFormatPrompt = await db.getSetting('taxonomy_format_prompt')

    const defaultAnalysisPrompt = `Ты - аналитик новостного контента. Проанализируй статью и предоставь структурированный результат.

ЗАДАЧИ:

1. META_DESCRIPTION (150-160 символов):
   - Краткое описание сути статьи для SEO
   - Нейтральный тон, максимально информативно
   - Для поисковых систем и социальных сетей

2. SUMMARY (3-5 предложений):
   - Выдели основные моменты и ключевые идеи
   - Профессиональный аналитический стиль
   - Полностью нейтральное изложение без эмоциональной окраски
   - Простой человеческий язык для комфортного восприятия
   - ВАЖНО: Перефразируй своими словами, НЕ копируй предложения из оригинала
   - SEO уникальность 90%+

3. SENTIMENT (тональность материала):
   - positive (позитивная)
   - neutral (нейтральная)
   - negative (негативная)

4. CONTENT_TYPE (тип контента):
   - purely_factual (новостная заметка, только факты)
   - mostly_factual (преимущественно факты с элементами анализа)
   - balanced (факты и мнения примерно поровну)
   - mostly_opinion (аналитика с мнениями)
   - purely_opinion (авторская колонка, редакционная статья)

ФОРМАТ ВЫВОДА (JSON):
{
  "meta_description": "...",
  "summary": "...",
  "sentiment": "...",
  "content_type": "...",
  "taxonomy": {
    "country": "Название страны или null",
    "city": "Название города или null",
    "themes": ["Список тем"],
    "tags": ["Список тегов"],
    "alliances": ["Список союзов и блоков"]
  }
}

Ответ должен быть на русском языке. Никакого markdown или дополнительного текста - только чистый JSON.`
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
        claudeApiKey: claudeApiKey || '',
        aiProvider: aiProvider || 'gemini',
        analysisPrompt: analysisPrompt || defaultAnalysisPrompt,
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
    const { geminiApiKey, claudeApiKey, aiProvider, analysisPrompt, summaryPrompt, taxonomySystemPrompt, taxonomyFormatPrompt } = body

    const apiKey = aiProvider === 'claude' ? claudeApiKey : geminiApiKey
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API ключ обязателен' },
        { status: 400 }
      )
    }

    await db.setSetting('gemini_api_key', geminiApiKey || '')
    await db.setSetting('claude_api_key', claudeApiKey || '')
    await db.setSetting('ai_provider', aiProvider || 'gemini')
    
    if (analysisPrompt) {
      await db.setSetting('analysis_prompt', analysisPrompt)
    }

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

