import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rssParser } from '@/lib/rss-parser'

// POST - импортировать материалы из локального фида
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { feedId } = body

    if (!feedId) {
      return NextResponse.json(
        { success: false, error: 'Feed ID is required' },
        { status: 400 }
      )
    }

    console.log(`[Local Feeds Import] Importing from feed ID: ${feedId}`)

    // Получаем информацию о фиде
    const feed = await db.getFeedById(parseInt(feedId))
    
    if (!feed) {
      return NextResponse.json(
        { success: false, error: 'Feed not found' },
        { status: 404 }
      )
    }

    // Парсим фид
    const feedData = await rssParser.parseFeed(feed.url)
    
    // Конвертируем в материалы
    const materials = rssParser.convertToMaterials(feed.title || feedData.title, feed.url, feedData.items)
    
    if (materials.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No materials found in this feed',
        data: { fetched: 0, new: 0, updated: 0, errors: 0 },
      })
    }

    // Сохраняем в базу
    const stats = await db.saveMaterials(materials)
    
    // Обновляем время последней загрузки
    await db.updateFeedFetchTime(feed.id)

    console.log(`[Local Feeds Import] Imported ${materials.length} materials (${stats.new} new, ${stats.updated} updated)`)

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
    console.error('Error importing from local feed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to import materials'
      },
      { status: 500 }
    )
  }
}

