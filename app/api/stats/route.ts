import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const stats = await db.getStats()

    return NextResponse.json({
      success: true,
      data: {
        total: parseInt(stats.total) || 0,
        new: parseInt(stats.new_count) || 0,
        processed: parseInt(stats.processed_count) || 0,
        archived: parseInt(stats.archived_count) || 0,
        lastFetch: stats.last_fetch,
      },
    })
  } catch (error) {
    console.error('Stats API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
