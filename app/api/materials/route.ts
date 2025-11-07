import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let materials
    if (status) {
      materials = await db.getMaterialsByStatus(status)
    } else {
      materials = await db.getAllMaterials(limit, offset)
    }

    return NextResponse.json({
      success: true,
      data: materials,
      count: materials.length,
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
