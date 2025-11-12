import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const materials = await db.getMaterialsByStatus('processed')

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
    return NextResponse.json(
      { success: false, error: 'Failed to fetch materials' },
      { status: 500 }
    )
  }
}

