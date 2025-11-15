import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'

const SOURCE_KEY = 'public_home_sources'
const CATEGORY_KEY = 'public_home_categories'
const COUNTRY_KEY = 'public_home_countries'

function parseStringList(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    }
    return []
  } catch {
    return []
  }
}

function parseNumberList(value: string | null): number[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => Number(item))
        .filter((num) => Number.isFinite(num) && !Number.isNaN(num))
    }
    return []
  } catch {
    return []
  }
}

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [publishedMaterials, sourcesSetting, categoriesSetting, countriesSetting] =
      await Promise.all([
        db.getMaterialsByStatus('published'),
        db.getSetting(SOURCE_KEY),
        db.getSetting(CATEGORY_KEY),
        db.getSetting(COUNTRY_KEY),
      ])

    const allowedSources = parseStringList(sourcesSetting)
    const allowedCategoryIds = parseNumberList(categoriesSetting)
    const allowedCountryIds = parseNumberList(countriesSetting)

    const processedMaterials = publishedMaterials.filter((material) => material.processed)

    const filteredBySettings = processedMaterials.filter((material) => {
      const sourceName = (material.feedName || material.source || '').trim()
      if (allowedSources.length > 0 && !allowedSources.includes(sourceName)) {
        return false
      }

      const categoryIds = material.categories?.map((category) => category.id) ?? []
      if (
        allowedCategoryIds.length > 0 &&
        !categoryIds.some((id) => allowedCategoryIds.includes(id))
      ) {
        return false
      }

      const countryIds = material.countries?.map((country) => country.id) ?? []
      if (
        allowedCountryIds.length > 0 &&
        !countryIds.some((id) => allowedCountryIds.includes(id))
      ) {
        return false
      }

      return true
    })

    const materials = filteredBySettings.map((material) => ({
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

