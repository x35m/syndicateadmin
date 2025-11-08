import { NextResponse } from 'next/server'
import { apiService } from '@/lib/api-service'

// GET - получить список всех фидов
export async function GET() {
  try {
    const subscriptions = await apiService.getSubscriptions()
    
    return NextResponse.json({
      success: true,
      data: subscriptions,
    })
  } catch (error) {
    console.error('Error fetching feeds:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch feeds'
      },
      { status: 500 }
    )
  }
}

// POST - подписаться на новый фид
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { feedUrl, categoryId } = body

    if (!feedUrl) {
      return NextResponse.json(
        { success: false, error: 'Feed URL is required' },
        { status: 400 }
      )
    }

    // Подписываемся на фид в CommaFeed
    const result = await apiService.subscribeFeed(feedUrl, categoryId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to feed',
      data: result,
    })
  } catch (error) {
    console.error('Error subscribing to feed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to subscribe to feed'
      },
      { status: 500 }
    )
  }
}

// DELETE - отписаться от фида
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

    const result = await apiService.unsubscribeFeed(feedId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from feed',
    })
  } catch (error) {
    console.error('Error unsubscribing from feed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to unsubscribe from feed'
      },
      { status: 500 }
    )
  }
}

