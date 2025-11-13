import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const taxonomy = await db.getTaxonomy()
    return NextResponse.json({ success: true, ...taxonomy })
  } catch (error) {
    console.error('Error fetching taxonomy:', error)
    await logSystemError('api/taxonomy', error, { method: 'GET' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch taxonomy' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, name, countryId } = body as {
      type?: 'category' | 'country' | 'city'
      name?: string
      countryId?: number
    }

    if (!type || !name) {
      return NextResponse.json({ success: false, error: 'Не указан тип или название' }, { status: 400 })
    }

    try {
      const created = await db.createTaxonomyItem(type, name, { countryId })
      return NextResponse.json({ success: true, data: created })
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505') {
        return NextResponse.json({ success: false, error: 'Такой элемент уже существует' }, { status: 409 })
      }
      throw error
    }
  } catch (error) {
    console.error('Error creating taxonomy item:', error)
    await logSystemError('api/taxonomy', error, { method: 'POST' })
    const message = error instanceof Error ? error.message : 'Не удалось создать элемент'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { type, id, name, countryId, isHidden } = body as {
      type?: 'category' | 'country' | 'city'
      id?: number
      name?: string
      countryId?: number | null
      isHidden?: boolean
    }

    if (!type || !id) {
      return NextResponse.json(
        { success: false, error: 'Не указан тип или идентификатор' },
        { status: 400 }
      )
    }

    const updated = await db.updateTaxonomyItem(type, id, {
      name,
      countryId,
      isHidden,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating taxonomy item:', error)
    await logSystemError('api/taxonomy', error, { method: 'PATCH' })
    const message = error instanceof Error ? error.message : 'Не удалось обновить элемент'
    const status =
      error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505'
        ? 409
        : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as
      | 'category'
      | 'country'
      | 'city'
      | null
    const id = searchParams.get('id')

    if (!type || !id) {
      return NextResponse.json(
        { success: false, error: 'Не указан тип или идентификатор' },
        { status: 400 }
      )
    }

    await db.deleteTaxonomyItem(type, Number(id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting taxonomy item:', error)
    await logSystemError('api/taxonomy', error, { method: 'DELETE' })
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Не удалось удалить элемент'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
