import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const taxonomy = await db.getTaxonomy()
    return NextResponse.json({ success: true, ...taxonomy })
  } catch (error) {
    console.error('Error fetching taxonomy:', error)
    return NextResponse.json({ success: false, error: 'Не удалось получить данные таксономии' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, name, countryId } = body as {
      type?: 'category' | 'theme' | 'tag' | 'country' | 'city'
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
    const message = error instanceof Error ? error.message : 'Не удалось создать элемент'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
