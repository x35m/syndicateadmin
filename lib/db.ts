import { Pool } from 'pg'
import { Material } from './types'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export class DatabaseService {
  async init() {
    const client = await pool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS materials (
          id VARCHAR(255) PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT,
          author VARCHAR(255),
          created_at TIMESTAMP NOT NULL,
          fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
          source VARCHAR(500),
          status VARCHAR(50) DEFAULT 'new',
          UNIQUE(id)
        )
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

  async saveMaterials(materials: Material[]): Promise<number> {
    if (materials.length === 0) return 0

    const client = await pool.connect()
    let savedCount = 0

    try {
      await client.query('BEGIN')

      for (const material of materials) {
        try {
          await client.query(
            `INSERT INTO materials (id, title, content, author, created_at, fetched_at, source, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [
              material.id,
              material.title,
              material.content,
              material.author,
              material.createdAt,
              material.fetchedAt,
              material.source,
              material.status,
            ]
          )
          savedCount++
        } catch (error) {
          console.error(`Error saving material ${material.id}:`, error)
        }
      }

      await client.query('COMMIT')
      return savedCount
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
      `SELECT id, title, content, author, 
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
      `SELECT id, title, content, author, 
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
}

export const db = new DatabaseService()
