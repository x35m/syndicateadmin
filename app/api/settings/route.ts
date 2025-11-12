import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const geminiApiKey = await db.getSetting('gemini_api_key')
    const claudeApiKey = await db.getSetting('claude_api_key')
    const aiProvider = await db.getSetting('ai_provider') || 'gemini'
    const geminiModel = await db.getSetting('gemini_model') || 'gemini-2.5-flash'
    const claudeModel = await db.getSetting('claude_model') || 'claude-3-5-sonnet-20240620'
    const analysisPrompt = await db.getSetting('analysis_prompt')
    const summaryPrompt = await db.getSetting('summary_prompt')
    const taxonomySystemPrompt = await db.getSetting('taxonomy_system_prompt')
    const taxonomyFormatPrompt = await db.getSetting('taxonomy_format_prompt')

  const defaultAnalysisPrompt = `Ты - аналитик новостного контента. Проанализируй статьи, создай качественные саммари и оцени характеристики материала.

ЗАДАЧИ:

1. META_DESCRIPTION (150-160 символов):
   - Краткое описание сути статьи для SEO
   - Нейтральный тон, максимально информативно
   - Для поисковых систем и социальных сетей

2. SUMMARY (3-5 предложений):
   - Выдели основные факты и ключевые идеи
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

5. TAXONOMY (классификация):
   - Определи страны и города, связанные с материалом

ПРИНЦИПЫ:
- Пиши напрямую, не ссылайся на статью («В материале говорится…»)
- Максимально информативно и нейтрально
- Избегай клише и оценочных суждений`
    const defaultSummaryPrompt =
      'Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).'
    const defaultTaxonomySystemPrompt =
      'Ты — редактор аналитического портала. Определи страну и города статьи так, чтобы они помогали редакции быстро рубрицировать материалы.'
    const defaultTaxonomyFormatPrompt =
      'Верни ответ строго в формате JSON:\n{\n  "summary": "краткое резюме на русском",\n  "taxonomy": {\n    "country": "Название страны или null",\n    "city": "Название города или null"\n  }\n}\nНе добавляй пояснений. Если не удалось определить значение, используй null.'

    return NextResponse.json({
      success: true,
      data: {
        geminiApiKey: geminiApiKey || '',
        claudeApiKey: claudeApiKey || '',
        aiProvider: aiProvider || 'gemini',
        geminiModel: geminiModel || 'gemini-2.5-flash',
        claudeModel: claudeModel || 'claude-3-5-sonnet-20240620',
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
    const { geminiApiKey, claudeApiKey, aiProvider, geminiModel, claudeModel, analysisPrompt, summaryPrompt, taxonomySystemPrompt, taxonomyFormatPrompt } = body

    const apiKey = aiProvider === 'claude' ? claudeApiKey : geminiApiKey
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API ключ обязателен' },
        { status: 400 }
      )
    }

    await db.setSetting('gemini_api_key', geminiApiKey || '')
    await db.setSetting('gemini_model', geminiModel || 'gemini-2.5-flash')
    await db.setSetting('claude_api_key', claudeApiKey || '')
    await db.setSetting('claude_model', claudeModel || 'claude-3-5-sonnet-20240620')
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

