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
    const prompt = `${summaryPrompt}\n\n${contentToAnalyze}`

    // Вызываем Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
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
      console.error('Gemini API error:', errorText)
      return NextResponse.json(
        { success: false, error: 'Ошибка при обращении к Gemini API' },
        { status: 500 }
      )
    }

    const geminiData = await geminiResponse.json()
    const summary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Не удалось получить саммари от Gemini' },
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

