import { NextResponse } from 'next/server'
import { apiService } from '@/lib/api-service'

export async function GET() {
  try {
    // Получаем список всех фидов
    const subscriptions = await apiService.getSubscriptions()
    
    // Получаем подробную информацию по каждому фиду
    const feedDetails = []
    
    for (const feed of subscriptions) {
      const materials = await apiService.fetchFromFeed(feed.id, 5) // Берем только 5 последних для теста
      feedDetails.push({
        id: feed.id,
        name: feed.name || feed.feedName || 'Unknown',
        url: feed.url || feed.feedUrl || 'Unknown',
        totalMaterials: materials.length,
        sampleTitles: materials.slice(0, 3).map(m => m.title),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        totalFeeds: subscriptions.length,
        feeds: feedDetails,
      },
    })
  } catch (error) {
    console.error('Debug feeds error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get feeds info'
      },
      { status: 500 }
    )
  }
}

