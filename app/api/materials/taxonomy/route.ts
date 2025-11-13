import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      materialId,
      categoryIds,
      countryIds,
      cityIds,
    } = body as {
      materialId?: string
      categoryIds?: number[] | string[]
      countryIds?: number[] | string[]
      cityIds?: number[] | string[]
    }

    if (!materialId) {
      return NextResponse.json({ success: false, error: 'Не указан материал' }, { status: 400 })
    }

    const parseIds = (value: number[] | string[] | undefined, label: string) => {
      if (!Array.isArray(value)) return undefined
      const parsed = value.map((id) => {
        const num = Number(id)
        if (Number.isNaN(num)) {
          throw new Error(`Некорректный идентификатор в списке ${label}`)
        }
        return num
      })
      return parsed
    }

    const normalized = {
      categoryIds: parseIds(categoryIds, 'категорий'),
      countryIds: parseIds(countryIds, 'стран'),
      cityIds: parseIds(cityIds, 'городов'),
    }

    await db.updateMaterialTaxonomy(materialId, normalized)
    const updated = await db.getMaterialById(materialId)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating material taxonomy:', error)
    await logSystemError('api/materials/taxonomy', error)
    const message = error instanceof Error ? error.message : 'Не удалось обновить таксономию материала'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
