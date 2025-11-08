import { NextResponse } from 'next/server'
import { apiService } from '@/lib/api-service'
import { db } from '@/lib/db'

// POST - импортировать материалы из конкретного фида
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { feedId, limit = 50 } = body

    if (!feedId) {
      return NextResponse.json(
        { success: false, error: 'Feed ID is required' },
        { status: 400 }
      )
    }

    console.log(`[${new Date().toISOString()}] Importing materials from feed: ${feedId}`)

    // Загружаем материалы из фида
    const materials = await apiService.fetchFromFeed(feedId, limit)
    
    if (materials.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No materials found in this feed',
        data: { fetched: 0, new: 0, updated: 0, errors: 0 },
      })
    }

    // Сохраняем в базу
    const stats = await db.saveMaterials(materials)

    console.log(`[${new Date().toISOString()}] Imported ${materials.length} materials from feed ${feedId}`)
    console.log(`  New: ${stats.new}, Updated: ${stats.updated}, Errors: ${stats.errors}`)

    return NextResponse.json({
      success: true,
      message: 'Materials imported successfully',
      data: {
        fetched: materials.length,
        new: stats.new,
        updated: stats.updated,
        errors: stats.errors,
      },
    })
  } catch (error) {
    console.error('Error importing materials:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to import materials'
      },
      { status: 500 }
    )
  }
}

