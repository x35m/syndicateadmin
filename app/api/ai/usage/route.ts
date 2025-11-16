import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const providerParam = url.searchParams.get('provider')
    const modelParam = url.searchParams.get('model')

    let provider = providerParam || 'gemini'
    let model = modelParam || 'gemini-2.5-flash'

    if (!providerParam || !modelParam) {
      const settings = await db.getSettings()
      provider = providerParam || settings['ai_provider'] || 'gemini'
      model =
        modelParam ||
        (provider === 'claude'
          ? settings['claude_model'] || 'claude-sonnet-4-20250514'
          : settings['gemini_model'] || 'gemini-2.5-flash')
    }

    const summary = await db.getAiUsageSummary()

    // Ограничения/квоты: у большинства провайдеров нет публичного API для получения текущих квот.
    // Возвращаем известную информацию и пометки.
    const limits = {
      provider,
      model,
      freeTier: 'Недоступно через публичный API — смотрите консоль провайдера',
      paidTier: 'Недоступно через публичный API — смотрите консоль провайдера',
      notes:
        provider === 'claude'
          ? 'Anthropic показывает usage per-request; агрегирование делаем на стороне сервера'
          : 'Google Gemini не возвращает usage токенов в ответе; учитываем вызовы и ориентировочные токены недоступны',
    }

    return NextResponse.json({
      success: true,
      data: {
        provider,
        model,
        limits,
        usage: summary,
      },
    })
  } catch (error) {
    console.error('Error fetching AI usage:', error)
    await logSystemError('api/ai/usage', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось получить usage AI' },
      { status: 500 }
    )
  }
}


