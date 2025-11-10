import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sources = searchParams.get('sources')
    
    // Получаем только опубликованные материалы
    const allMaterials = await db.getMaterialsByStatus('processed')
    
    // Фильтруем по источникам если указаны
    let materials = allMaterials
    if (sources) {
      const sourcesList = sources.split(',')
      materials = allMaterials.filter(m => 
        sourcesList.some(source => m.feedName === source || m.source === source)
      )
    }
    
    // Получаем уникальные источники для фильтра
    const uniqueSources = Array.from(
      new Set(allMaterials.map(m => m.feedName || m.source).filter(Boolean))
    ).sort()
    
    return NextResponse.json({
      success: true,
      data: materials,
      sources: uniqueSources,
    })
  } catch (error) {
    console.error('Error fetching public materials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch materials' },
      { status: 500 }
    )
  }
}

