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
    const themeIds = searchParams.get('themeIds')?.split(',').map(Number).filter(Boolean)
    const tagIds = searchParams.get('tagIds')?.split(',').map(Number).filter(Boolean)
    const allianceIds = searchParams.get('allianceIds')?.split(',').map(Number).filter(Boolean)
    const countryIds = searchParams.get('countryIds')?.split(',').map(Number).filter(Boolean)
    const cityIds = searchParams.get('cityIds')?.split(',').map(Number).filter(Boolean)
    const feedNames = searchParams.get('feedNames')?.split(',').filter(Boolean)
    const onlyWithSummary = searchParams.get('onlyWithSummary') === 'true'

    // If pagination params are provided, use paginated endpoint
    if (page !== undefined || pageSize !== undefined || search || categoryIds || themeIds || tagIds || allianceIds || countryIds || cityIds || feedNames || onlyWithSummary) {
      const result = await db.getMaterialsPaginated({
        page,
        pageSize,
        status: status || undefined,
        search,
        categoryIds,
        themeIds,
        tagIds,
        allianceIds,
        countryIds,
        cityIds,
        feedNames,
        onlyWithSummary,
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
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing id or status' },
        { status: 400 }
      )
    }

    await db.updateMaterialStatus(id, status)

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
