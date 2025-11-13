import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : 200

    const logs = await db.getSystemLogs(limit)

    return NextResponse.json({
      success: true,
      data: logs,
    })
  } catch (error) {
    console.error('Error fetching system logs:', error)
    await logSystemError('api/system-logs', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось получить системные логи' },
      { status: 500 }
    )
  }
}
