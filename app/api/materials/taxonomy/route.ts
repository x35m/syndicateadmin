import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      materialId,
      categoryIds,
      themeIds,
      tagIds,
      allianceIds,
      countryId,
      cityId,
    } = body as {
      materialId?: string
      categoryIds?: number[] | string[]
      themeIds?: number[] | string[]
      tagIds?: number[] | string[]
      allianceIds?: number[] | string[]
      countryId?: number | string | null
      cityId?: number | string | null
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

    const parseNullableNumber = (value: number | string | null | undefined, label: string) => {
      if (value === undefined) return undefined
      if (value === null || value === '') return null
      const num = Number(value)
      if (Number.isNaN(num)) {
        throw new Error(`Некорректный идентификатор для ${label}`)
      }
      return num
    }

    const normalized = {
      categoryIds: parseIds(categoryIds, 'категорий'),
      themeIds: parseIds(themeIds, 'тем'),
      tagIds: parseIds(tagIds, 'тегов'),
      allianceIds: parseIds(allianceIds, 'политических союзов'),
      countryId: parseNullableNumber(countryId, 'страны'),
      cityId: parseNullableNumber(cityId, 'города'),
    }

    await db.updateMaterialTaxonomy(materialId, normalized)
    const updated = await db.getMaterialById(materialId)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating material taxonomy:', error)
    const message = error instanceof Error ? error.message : 'Не удалось обновить таксономию материала'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
