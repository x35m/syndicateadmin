import { NextResponse } from 'next/server'
import { fetchAndSaveMaterials } from '@/lib/cron'

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
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to sync materials'
      },
      { status: 500 }
    )
  }
}
