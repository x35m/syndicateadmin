import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rssParser } from '@/lib/rss-parser'
import { logSystemError } from '@/lib/logger'

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
    await logSystemError('api/local-feeds', error, { method: 'GET' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch local feeds' },
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
      await logSystemError('api/local-feeds', parseError, {
        method: 'POST',
        feedUrl: feedUrl,
      })
      
      let errorMessage = 'Не удалось загрузить или распарсить RSS фид.'
      
      if (parseError instanceof Error) {
        // Показываем более детальную ошибку
        errorMessage = parseError.message
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage
        },
        { status: 400 }
      )
    }
    
    // Проверяем что в фиде есть материалы
    if (!feedInfo.items || feedInfo.items.length === 0) {
      console.warn('[Local Feeds] Feed has no items:', feedInfo)
      return NextResponse.json(
        { 
          success: false, 
          error: 'RSS фід успішно завантажений, але не містить жодних матеріалів. Це може бути порожній фід.'
        },
        { status: 400 }
      )
    }

    // Добавляем фид в базу
    const feed = await db.addFeed(feedUrl, feedInfo.title, feedInfo.description)

    console.log(`[Local Feeds] Feed added successfully:`, feed)

    // Сразу импортируем материалы из фида
    const materials = await rssParser.convertToMaterials(feedInfo.title, feedUrl, feedInfo.items)
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
    await logSystemError('api/local-feeds', error, { method: 'POST' })
    return NextResponse.json(
      { success: false, error: 'Failed to add local feed' },
      { status: 500 }
    )
  }
}

// PATCH - обновить название фида
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, title, status } = body as {
      id?: string | number
      title?: string
      status?: 'active' | 'inactive'
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Feed ID is required' },
        { status: 400 }
      )
    }

    const feedId = Number(id)
    if (Number.isNaN(feedId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid feed ID' },
        { status: 400 }
      )
    }

    if (!title && !status) {
      return NextResponse.json(
        { success: false, error: 'Nothing to update' },
        { status: 400 }
      )
    }

    if (title) {
      await db.updateFeedTitle(feedId, title)
    }

    if (status) {
      await db.updateFeedStatus(feedId, status)
    }

    const updated = await db.getFeedById(feedId)

    return NextResponse.json({
      success: true,
      message: 'Feed updated successfully',
      data: updated,
    })
  } catch (error) {
    console.error('Error updating feed title:', error)
    await logSystemError('api/local-feeds', error, { method: 'PATCH' })
    return NextResponse.json(
      { success: false, error: 'Failed to update feed title' },
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
    await logSystemError('api/local-feeds', error, { method: 'DELETE' })
    return NextResponse.json(
      { success: false, error: 'Failed to delete local feed' },
      { status: 500 }
    )
  }
}

