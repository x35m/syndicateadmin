import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'
import type { PublicHomeFilters } from '@/lib/types'

export const dynamic = 'force-dynamic'

const SOURCE_KEY = 'public_home_sources'
const CATEGORY_KEY = 'public_home_categories'
const COUNTRY_KEY = 'public_home_countries'

function parseStringList(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.map((item) => String(item).trim()).filter(Boolean)))
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
      return Array.from(
        new Set(
          parsed
            .map((item) => Number(item))
            .filter((num) => Number.isFinite(num) && !Number.isNaN(num))
        )
      )
    }
    return []
  } catch {
    return []
  }
}

async function getSelectedFilters(): Promise<PublicHomeFilters> {
  const [sources, categories, countries] = await Promise.all([
    db.getSetting(SOURCE_KEY),
    db.getSetting(CATEGORY_KEY),
    db.getSetting(COUNTRY_KEY),
  ])

  return {
    sources: parseStringList(sources),
    categories: parseNumberList(categories),
    countries: parseNumberList(countries),
  }
}

export async function GET() {
  try {
    const [selected, taxonomy, publishedMaterials] = await Promise.all([
      getSelectedFilters(),
      db.getTaxonomy(),
      db.getMaterialsByStatus('published'),
    ])

    const processedMaterials = publishedMaterials.filter((material) => material.processed)

    const sourceCounts = new Map<string, number>()
    const categoryCounts = new Map<number, number>()
    const countryCounts = new Map<number, number>()

    processedMaterials.forEach((material) => {
      const sourceName = (material.feedName || material.source || '').trim()
      if (sourceName) {
        sourceCounts.set(sourceName, (sourceCounts.get(sourceName) ?? 0) + 1)
      }

      material.categories?.forEach((category) => {
        if (!category) return
        categoryCounts.set(category.id, (categoryCounts.get(category.id) ?? 0) + 1)
      })

      material.countries?.forEach((country) => {
        if (!country) return
        countryCounts.set(country.id, (countryCounts.get(country.id) ?? 0) + 1)
      })
    })

    const sourceOptions = Array.from(sourceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    const categoryOptions = taxonomy.categories.map((category) => ({
      id: category.id,
      name: category.name,
      count: categoryCounts.get(category.id) ?? 0,
    }))

    const countryOptions = taxonomy.countries.map((country) => ({
      id: country.id,
      name: country.name,
      count: countryCounts.get(country.id) ?? 0,
    }))

    return NextResponse.json({
      success: true,
      data: selected,
      options: {
        sources: sourceOptions,
        categories: categoryOptions,
        countries: countryOptions,
      },
    })
  } catch (error) {
    console.error('Error fetching public home settings:', error)
    await logSystemError('api/public/home-settings', error, { method: 'GET' })
    return NextResponse.json(
      { success: false, error: 'Не удалось получить настройки главной страницы' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<PublicHomeFilters>

    const normalizedSources = Array.from(
      new Set((body.sources ?? []).map((source) => source.trim()).filter(Boolean))
    )

    const normalizedCategories = Array.from(
      new Set(
        (body.categories ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && !Number.isNaN(id))
      )
    )

    const normalizedCountries = Array.from(
      new Set(
        (body.countries ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && !Number.isNaN(id))
      )
    )

    await Promise.all([
      db.setSetting(SOURCE_KEY, JSON.stringify(normalizedSources)),
      db.setSetting(CATEGORY_KEY, JSON.stringify(normalizedCategories)),
      db.setSetting(COUNTRY_KEY, JSON.stringify(normalizedCountries)),
    ])

    return NextResponse.json({
      success: true,
      data: {
        sources: normalizedSources,
        categories: normalizedCategories,
        countries: normalizedCountries,
      },
    })
  } catch (error) {
    console.error('Error saving public home settings:', error)
    await logSystemError('api/public/home-settings', error, { method: 'POST' })
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить настройки главной страницы' },
      { status: 500 }
    )
  }
}

