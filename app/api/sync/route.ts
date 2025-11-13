import { NextResponse } from 'next/server'
import { fetchAndSaveMaterials } from '@/lib/cron'
import { logSystemError } from '@/lib/logger'

export async function POST() {
  try {
    const result = await fetchAndSaveMaterials()

    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      data: result,
    })
  } catch (error) {
    console.error('Sync API Error:', error)
    await logSystemError('api/sync', error)
    return NextResponse.json(
      { success: false, error: 'Failed to start synchronization' },
      { status: 500 }
    )
  }
}
