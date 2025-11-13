import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const publishedMaterials = await db.getMaterialsByStatus('published')
    const processedMaterials = publishedMaterials.filter((material) => material.processed)

    const materials = processedMaterials.map((material) => ({
      ...material,
      categories: (material.categories ?? []).filter((category) => !category?.isHidden),
    }))

    const sources = Array.from(
      new Set(
        materials
          .map((material) => material.feedName || material.source)
          .filter((source): source is string => Boolean(source))
      )
    ).sort((a, b) => a.localeCompare(b, 'ru'))

    const regions = Array.from(
      new Map<number, string>(
        materials
          .flatMap((material) => material.countries ?? [])
          .map((country) => [country.id, country.name])
      ).entries()
    )
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    const categories = Array.from(
      new Map<number, string>(
        materials.flatMap((material) => material.categories ?? []).map((category) => [
          category.id,
          category.name,
        ])
      ).entries()
    )
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    
    return NextResponse.json({
      success: true,
      data: materials,
      filters: {
        sources,
        regions,
        categories,
      },
    })
  } catch (error) {
    console.error('Error fetching public materials:', error)
    await logSystemError('api/public/materials', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch materials' },
      { status: 500 }
    )
  }
}

