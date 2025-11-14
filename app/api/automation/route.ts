import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'
import {
  refreshAutomationScheduler,
} from '@/lib/automation'
import {
  DEFAULT_AUTOMATION_CONFIG,
  normalizeAutomationConfig,
} from '@/lib/automation-config'
import type { AutomationConfig } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stored = await db.getAutomationConfig()
    const config = normalizeAutomationConfig(stored)

    return NextResponse.json({
      success: true,
      data: config,
    })
  } catch (error) {
    console.error('Error fetching automation config:', error)
    await logSystemError('api/automation', error, { method: 'GET' })
    return NextResponse.json(
      { success: false, error: 'Не удалось получить настройки автоматизации' },
      { status: 500 }
    )
  }
}

function validateConfig(config: AutomationConfig): string | null {
  if (config.import.enabled && config.import.scope === 'selected' && config.import.feedIds.length === 0) {
    return 'Выберите хотя бы один активный фид для автоимпорта'
  }

  if (config.processing.enabled && config.processing.batchSize <= 0) {
    return 'Размер пакета для автообработки должен быть больше нуля'
  }

  if (config.publishing.enabled && config.publishing.scope === 'selected' && config.publishing.categoryIds.length === 0) {
    return 'Выберите хотя бы одну категорию для автопубликации'
  }

  if (config.publishing.enabled && config.publishing.batchSize <= 0) {
    return 'Размер пакета для автопубликации должен быть больше нуля'
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AutomationConfig | null
    const nextConfig = normalizeAutomationConfig(body ?? DEFAULT_AUTOMATION_CONFIG)

    const validationError = validateConfig(nextConfig)
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      )
    }

    await db.setAutomationConfig(nextConfig)
    await refreshAutomationScheduler()

    return NextResponse.json({
      success: true,
      data: nextConfig,
    })
  } catch (error) {
    console.error('Error updating automation config:', error)
    await logSystemError('api/automation', error, { method: 'POST' })
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить настройки автоматизации' },
      { status: 500 }
    )
  }
}
