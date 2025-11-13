import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : undefined
    const search = searchParams.get('search') || undefined
    const categoryIds = searchParams.get('categoryIds')?.split(',').map(Number).filter(Boolean)
    const countryIds = searchParams.get('countryIds')?.split(',').map(Number).filter(Boolean)
    const cityIds = searchParams.get('cityIds')?.split(',').map(Number).filter(Boolean)
    const feedNames = searchParams.get('feedNames')?.split(',').filter(Boolean)

    // If pagination params are provided, use paginated endpoint
    if (page !== undefined || pageSize !== undefined || search || categoryIds || countryIds || cityIds || feedNames) {
      const result = await db.getMaterialsPaginated({
        page,
        pageSize,
        status: status || undefined,
        search,
        categoryIds,
        countryIds,
        cityIds,
        feedNames,
      })

      // Get stats for the current filter
      const stats = await db.getStats()
      
      return NextResponse.json({
        success: true,
        data: result.materials,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
        stats: {
          total: parseInt(stats.total || '0'),
          new: parseInt(stats.new_count || '0'),
          processed: parseInt(stats.processed_count || '0'),
          published: parseInt(stats.published_count || '0'),
          archived: parseInt(stats.archived_count || '0'),
        },
      })
    }

    // Legacy endpoint - get all materials (for backward compatibility)
    let materials
    if (status && status !== 'all') {
      materials = await db.getMaterialsByStatus(status)
    } else {
      materials = await db.getAllMaterials()
    }

    // Получаем статистику по статусам
    const stats = await db.getStats()
    
    return NextResponse.json({
      success: true,
      data: materials,
      stats: {
        total: parseInt(stats.total || '0'),
        new: parseInt(stats.new_count || '0'),
        processed: parseInt(stats.processed_count || '0'),
        published: parseInt(stats.published_count || '0'),
        archived: parseInt(stats.archived_count || '0'),
      },
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch materials' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, processed, published, summary, metaDescription } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing id' },
        { status: 400 }
      )
    }

    const updates: {
      status?: string
      processed?: boolean
      published?: boolean
    } = {}
    const summaryUpdates: {
      summary?: string
      metaDescription?: string
    } = {}

    if (typeof status === 'string' && status.trim().length > 0) {
      updates.status = status.trim()
    }
    if (typeof processed === 'boolean') {
      updates.processed = processed
    }
    if (typeof published === 'boolean') {
      updates.published = published
    }
    if (typeof summary === 'string') {
      summaryUpdates.summary = summary
    }
    if (typeof metaDescription === 'string') {
      summaryUpdates.metaDescription = metaDescription
    }

    if (Object.keys(updates).length === 0 && Object.keys(summaryUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates were provided' },
        { status: 400 }
      )
    }

    if (Object.keys(updates).length > 0) {
      await db.updateMaterialAttributes(id, updates)
    }

    if (Object.keys(summaryUpdates).length > 0) {
      await db.updateMaterialSummary(id, summaryUpdates)
    }

    return NextResponse.json({
      success: true,
      message: 'Material updated successfully',
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update material' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing material ID' },
        { status: 400 }
      )
    }

    await db.deleteMaterial(id)

    return NextResponse.json({
      success: true,
      message: 'Material deleted successfully',
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete material' },
      { status: 500 }
    )
  }
}
