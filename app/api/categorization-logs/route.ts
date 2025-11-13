import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : 100

    const logs = await db.getCategorizationLogs(limit)

    return NextResponse.json({
      success: true,
      data: logs,
    })
  } catch (error) {
    console.error('Error fetching categorization logs:', error)
    await logSystemError('api/categorization-logs', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось получить логи классификации' },
      { status: 500 }
    )
  }
}
