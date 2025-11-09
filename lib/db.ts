import { Pool } from 'pg'
import { Material } from './types'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export class DatabaseService {
  async init() {
    const client = await pool.connect()
    try {
      // Таблица для локальных RSS фидов
      await client.query(`
        CREATE TABLE IF NOT EXISTS feeds (
          id SERIAL PRIMARY KEY,
          url TEXT NOT NULL UNIQUE,
          title TEXT,
          description TEXT,
          last_fetched TIMESTAMP,
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status)
      `)
      
      // Таблица для материалов
      await client.query(`
        CREATE TABLE IF NOT EXISTS materials (
          id VARCHAR(255) PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT,
          full_content TEXT,
          thumbnail TEXT,
          author VARCHAR(255),
          created_at TIMESTAMP NOT NULL,
          fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
          source VARCHAR(500),
          status VARCHAR(50) DEFAULT 'new',
          UNIQUE(id)
        )
      `)
      
      // Миграция: добавляем новые колонки если их нет
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'full_content'
          ) THEN
            ALTER TABLE materials ADD COLUMN full_content TEXT;
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'thumbnail'
          ) THEN
            ALTER TABLE materials ADD COLUMN thumbnail TEXT;
          END IF;
        END $$;
      `)
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status)
      `)
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC)
      `)
      
      console.log('Database initialized successfully')
    } finally {
      client.release()
    }
  }

  async saveMaterials(materials: Material[]): Promise<{ new: number; updated: number; errors: number }> {
    if (materials.length === 0) return { new: 0, updated: 0, errors: 0 }

    const client = await pool.connect()
    let newCount = 0
    let updatedCount = 0
    let errorCount = 0

    try {
      await client.query('BEGIN')

      for (const material of materials) {
        try {
          // Проверяем существует ли материал
          const checkResult = await client.query(
            'SELECT id FROM materials WHERE id = $1',
            [material.id]
          )
          
          const exists = checkResult.rows.length > 0

          await client.query(
            `INSERT INTO materials (id, title, content, full_content, thumbnail, author, created_at, fetched_at, source, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO UPDATE SET
               full_content = EXCLUDED.full_content,
               thumbnail = EXCLUDED.thumbnail,
               fetched_at = EXCLUDED.fetched_at`,
            [
              material.id,
              material.title,
              material.content,
              material.fullContent,
              material.thumbnail,
              material.author,
              material.createdAt,
              material.fetchedAt,
              material.source,
              material.status,
            ]
          )
          
          if (exists) {
            updatedCount++
          } else {
            newCount++
          }
        } catch (error) {
          console.error(`Error saving material ${material.id}:`, error)
          errorCount++
        }
      }

      await client.query('COMMIT')
      return { new: newCount, updated: updatedCount, errors: errorCount }
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Error in saveMaterials:', error)
      throw error
    } finally {
      client.release()
    }
  }

  async getAllMaterials(limit = 100, offset = 0): Promise<Material[]> {
    const result = await pool.query(
      `SELECT id, title, content, full_content as "fullContent", thumbnail, author, 
              created_at as "createdAt", 
              fetched_at as "fetchedAt", 
              source, status
       FROM materials
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    return result.rows
  }

  async getMaterialsByStatus(status: string): Promise<Material[]> {
    const result = await pool.query(
      `SELECT id, title, content, full_content as "fullContent", thumbnail, author, 
              created_at as "createdAt", 
              fetched_at as "fetchedAt", 
              source, status
       FROM materials
       WHERE status = $1
       ORDER BY created_at DESC`,
      [status]
    )

    return result.rows
  }

  async updateMaterialStatus(id: string, status: string): Promise<void> {
    await pool.query(
      'UPDATE materials SET status = $1 WHERE id = $2',
      [status, id]
    )
  }

  async deleteMaterial(id: string): Promise<void> {
    await pool.query(
      'DELETE FROM materials WHERE id = $1',
      [id]
    )
  }

  async getStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'processed') as processed_count,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
        MAX(fetched_at) as last_fetch
      FROM materials
    `)

    return result.rows[0]
  }

  async close() {
    await pool.end()
  }

  // ========== МЕТОДЫ ДЛЯ РАБОТЫ С ФИДАМИ ==========
  
  async addFeed(url: string, title?: string, description?: string) {
    const result = await pool.query(
      `INSERT INTO feeds (url, title, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (url) DO UPDATE SET
         title = COALESCE(EXCLUDED.title, feeds.title),
         description = COALESCE(EXCLUDED.description, feeds.description)
       RETURNING *`,
      [url, title, description]
    )
    return result.rows[0]
  }

  async getAllFeeds() {
    const result = await pool.query(
      `SELECT id, url, title, description, last_fetched as "lastFetched", status, created_at as "createdAt"
       FROM feeds
       WHERE status = 'active'
       ORDER BY created_at DESC`
    )
    return result.rows
  }

  async getFeedById(id: number) {
    const result = await pool.query(
      `SELECT id, url, title, description, last_fetched as "lastFetched", status, created_at as "createdAt"
       FROM feeds
       WHERE id = $1`,
      [id]
    )
    return result.rows[0]
  }

  async updateFeedFetchTime(id: number) {
    await pool.query(
      'UPDATE feeds SET last_fetched = NOW() WHERE id = $1',
      [id]
    )
  }

  async deleteFeed(id: number) {
    await pool.query(
      'UPDATE feeds SET status = $1 WHERE id = $2',
      ['deleted', id]
    )
  }
}

export const db = new DatabaseService()
