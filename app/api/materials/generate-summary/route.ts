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
    const contentToAnalyze = material.fullContent || material.content
    
    if (!contentToAnalyze || contentToAnalyze.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Материал не содержит текста для анализа' },
        { status: 400 }
      )
    }
    
    const defaultPrompt = 'Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).'
    const prompt = `${summaryPrompt || defaultPrompt}\n\n${contentToAnalyze}`
    
    console.log(`Generating summary for material ${materialId}. Content length: ${contentToAnalyze.length}`)

    // Вызываем Gemini API (используем gemini-1.5-flash - быстрая и эффективная модель)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errorText)
      
      let errorMessage = 'Ошибка при обращении к Gemini API'
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorMessage
      } catch (e) {
        // ignore parse error
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
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

