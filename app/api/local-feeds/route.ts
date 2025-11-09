import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rssParser } from '@/lib/rss-parser'

// GET - получить все локальные фиды
export async function GET() {
  try {
    const feeds = await db.getAllFeeds()
    
    return NextResponse.json({
      success: true,
      data: feeds,
    })
  } catch (error) {
    console.error('Error fetching local feeds:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch feeds'
      },
      { status: 500 }
    )
  }
}

// POST - добавить новый локальный фид
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { feedUrl } = body

    if (!feedUrl) {
      return NextResponse.json(
        { success: false, error: 'Feed URL is required' },
        { status: 400 }
      )
    }

    console.log(`[Local Feeds] Adding new feed: ${feedUrl}`)

    // Парсим фид чтобы получить название и описание
    let feedInfo
    try {
      feedInfo = await rssParser.parseFeed(feedUrl)
    } catch (parseError) {
      console.error('[Local Feeds] Failed to parse feed:', parseError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Не удалось загрузить или распарсить RSS фид. Проверьте URL и убедитесь что это валидный RSS/Atom фид.'
        },
        { status: 400 }
      )
    }

    // Добавляем фид в базу
    const feed = await db.addFeed(feedUrl, feedInfo.title, feedInfo.description)

    console.log(`[Local Feeds] Feed added successfully:`, feed)

    // Сразу импортируем материалы из фида
    const materials = rssParser.convertToMaterials(feedInfo.title, feedUrl, feedInfo.items)
    const stats = await db.saveMaterials(materials)
    
    // Обновляем время последней загрузки
    await db.updateFeedFetchTime(feed.id)

    console.log(`[Local Feeds] Imported ${materials.length} materials (${stats.new} new, ${stats.updated} updated)`)

    return NextResponse.json({
      success: true,
      message: 'Feed added and materials imported successfully',
      data: {
        feed,
        stats: {
          fetched: materials.length,
          new: stats.new,
          updated: stats.updated,
        },
      },
    })
  } catch (error) {
    console.error('Error adding local feed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add feed'
      },
      { status: 500 }
    )
  }
}

// DELETE - удалить локальный фид
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const feedId = searchParams.get('id')

    if (!feedId) {
      return NextResponse.json(
        { success: false, error: 'Feed ID is required' },
        { status: 400 }
      )
    }

    await db.deleteFeed(parseInt(feedId))

    return NextResponse.json({
      success: true,
      message: 'Feed deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting local feed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete feed'
      },
      { status: 500 }
    )
  }
}

