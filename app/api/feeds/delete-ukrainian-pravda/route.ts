import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logSystemError } from '@/lib/logger'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('Поиск фида "Украинская правда"...')
    
    // Получаем все фиды
    const feeds = await db.getAllFeeds()
    const targetFeed = feeds.find(
      (feed) => feed.title?.toLowerCase().includes('украинская правда') ||
                feed.url?.toLowerCase().includes('pravda')
    )

    if (!targetFeed) {
      return NextResponse.json({
        success: false,
        error: 'Фид "Украинская правда" не найден в базе данных',
      }, { status: 404 })
    }

    console.log(`Найден фид: ID=${targetFeed.id}, Title="${targetFeed.title}", URL="${targetFeed.url}"`)

    // Подключаемся к базе напрямую для удаления
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })

    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      // 1. Удаляем связи материалов с категориями, странами и городами
      console.log('Удаление связей материалов...')
      await client.query(`
        DELETE FROM material_categories
        WHERE material_id IN (
          SELECT id FROM materials WHERE source = $1
        )
      `, [targetFeed.url])

      await client.query(`
        DELETE FROM material_countries
        WHERE material_id IN (
          SELECT id FROM materials WHERE source = $1
        )
      `, [targetFeed.url])

      await client.query(`
        DELETE FROM material_cities
        WHERE material_id IN (
          SELECT id FROM materials WHERE source = $1
        )
      `, [targetFeed.url])

      // 2. Удаляем сами материалы
      console.log('Удаление материалов...')
      const materialsResult = await client.query(
        'DELETE FROM materials WHERE source = $1 RETURNING id',
        [targetFeed.url]
      )
      const deletedMaterialsCount = materialsResult.rowCount || 0
      console.log(`Удалено материалов: ${deletedMaterialsCount}`)

      // 3. Удаляем фид
      console.log('Удаление фида...')
      await client.query('DELETE FROM feeds WHERE id = $1', [targetFeed.id])
      console.log('Фид удален')

      await client.query('COMMIT')
      
      return NextResponse.json({
        success: true,
        message: `Фид "${targetFeed.title}" и ${deletedMaterialsCount} связанных материалов успешно удалены`,
        deletedFeed: {
          id: targetFeed.id,
          title: targetFeed.title,
          url: targetFeed.url,
        },
        deletedMaterialsCount,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
      await pool.end()
    }
  } catch (error) {
    console.error('Ошибка при удалении:', error)
    await logSystemError('api/feeds/delete-ukrainian-pravda', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка при удалении фида и материалов' },
      { status: 500 }
    )
  }
}

