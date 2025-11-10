import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { materialId } = body

    if (!materialId) {
      return NextResponse.json(
        { success: false, error: 'Material ID is required' },
        { status: 400 }
      )
    }

    // Получаем настройки
    const geminiApiKey = await db.getSetting('gemini_api_key')
    const summaryPrompt = await db.getSetting('summary_prompt')

    if (!geminiApiKey) {
      return NextResponse.json(
        { success: false, error: 'Gemini API ключ не настроен. Перейдите в Настройки.' },
        { status: 400 }
      )
    }

    // Получаем материал
    const materials = await db.getAllMaterials()
    const material = materials.find(m => m.id === materialId)

    if (!material) {
      return NextResponse.json(
        { success: false, error: 'Material not found' },
        { status: 404 }
      )
    }

    // Формируем текст для анализа
    let contentToAnalyze = material.fullContent || material.content
    
    if (!contentToAnalyze || contentToAnalyze.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Материал не содержит текста для анализа' },
        { status: 400 }
      )
    }
    
    // Ограничиваем длину контента (макс 15000 символов для безопасности)
    const MAX_CONTENT_LENGTH = 15000
    if (contentToAnalyze.length > MAX_CONTENT_LENGTH) {
      console.log(`Content too long (${contentToAnalyze.length}), truncating to ${MAX_CONTENT_LENGTH}`)
      contentToAnalyze = contentToAnalyze.substring(0, MAX_CONTENT_LENGTH) + '...'
    }
    
    const defaultPrompt = 'Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).'
    const prompt = `${summaryPrompt || defaultPrompt}\n\n${contentToAnalyze}`
    
    console.log(`Generating summary for material ${materialId}. Content length: ${contentToAnalyze.length}, Prompt length: ${prompt.length}`)

    // Вызываем Gemini API (используем gemini-2.5-flash - балансированная модель)
    // Документация: https://ai.google.dev/gemini-api/docs
    console.log(`Calling Gemini API for material ${materialId}`)
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    }
    
    console.log('Request body:', JSON.stringify(requestBody).substring(0, 200) + '...')
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errorText)
      
      let errorMessage = 'Ошибка при обращении к Gemini API'
      let userFriendlyMessage = errorMessage
      
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorMessage
        
        // Делаем сообщение более понятным для пользователя
        if (errorMessage.includes('internal error')) {
          userFriendlyMessage = 'Временная ошибка Gemini API. Попробуйте через несколько секунд.'
        } else if (errorMessage.includes('API key')) {
          userFriendlyMessage = 'Проблема с API ключом. Проверьте настройки.'
        } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
          userFriendlyMessage = 'Превышен лимит запросов. Подождите немного.'
        } else if (errorMessage.includes('SAFETY')) {
          userFriendlyMessage = 'Контент заблокирован фильтром безопасности Gemini.'
        } else {
          userFriendlyMessage = errorMessage
        }
      } catch (e) {
        console.error('Failed to parse error:', e)
      }
      
      return NextResponse.json(
        { success: false, error: userFriendlyMessage, details: errorMessage },
        { status: geminiResponse.status }
      )
    }

    const geminiData = await geminiResponse.json()
    console.log('Gemini response:', JSON.stringify(geminiData, null, 2))
    
    const summary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!summary) {
      console.error('No summary in response. Full response:', geminiData)
      return NextResponse.json(
        { success: false, error: 'Не удалось получить саммари от Gemini. Проверьте формат ответа.' },
        { status: 500 }
      )
    }

    // Сохраняем саммари
    await db.updateMaterialSummary(materialId, summary)

    return NextResponse.json({
      success: true,
      data: {
        summary,
      },
    })
  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

