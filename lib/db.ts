import { Pool } from 'pg'
import { Material, Category, Theme, Tag, Alliance, Country, City } from './types'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export class DatabaseService {
  private materialSelect(whereClause?: string) {
    return `SELECT m.id,
                   m.title,
                   m.content,
                   m.full_content AS "fullContent",
                   m.thumbnail,
                   m.author,
                   m.created_at AS "createdAt",
                   m.fetched_at AS "fetchedAt",
                   m.link,
                   m.source,
                   m.status,
                   m.summary,
                   f.title AS "feedName",
                   country_data.country,
                   city_data.city,
                   categories_data.categories,
                   themes_data.themes,
                   tags_data.tags,
                   alliances_data.alliances
            FROM materials m
            LEFT JOIN feeds f ON m.source = f.url
            LEFT JOIN LATERAL (
              SELECT json_build_object('id', c.id, 'name', c.name) AS country
              FROM countries c
              WHERE c.id = m.country_id
            ) country_data ON TRUE
            LEFT JOIN LATERAL (
              SELECT json_build_object('id', ci.id, 'name', ci.name, 'countryId', ci.country_id) AS city
              FROM cities ci
              WHERE ci.id = m.city_id
            ) city_data ON TRUE
            LEFT JOIN LATERAL (
              SELECT COALESCE(
                json_agg(
                  json_build_object('id', cat.id, 'name', cat.name)
                  ORDER BY cat.name
                ),
                '[]'::json
              ) AS categories
              FROM material_categories mc
              JOIN categories cat ON cat.id = mc.category_id
              WHERE mc.material_id = m.id
            ) categories_data ON TRUE
            LEFT JOIN LATERAL (
              SELECT COALESCE(
                json_agg(
                  json_build_object('id', th.id, 'name', th.name)
                  ORDER BY th.name
                ),
                '[]'::json
              ) AS themes
              FROM material_themes mth
              JOIN themes th ON th.id = mth.theme_id
              WHERE mth.material_id = m.id
            ) themes_data ON TRUE
            LEFT JOIN LATERAL (
              SELECT COALESCE(
                json_agg(
                  json_build_object('id', tg.id, 'name', tg.name)
                  ORDER BY tg.name
                ),
                '[]'::json
              ) AS tags
              FROM material_tags mtg
              JOIN tags tg ON tg.id = mtg.tag_id
              WHERE mtg.material_id = m.id
            ) tags_data ON TRUE
            LEFT JOIN LATERAL (
              SELECT COALESCE(
                json_agg(
                  json_build_object('id', al.id, 'name', al.name)
                  ORDER BY al.name
                ),
                '[]'::json
              ) AS alliances
              FROM material_alliances ma
              JOIN alliances al ON al.id = ma.alliance_id
              WHERE ma.material_id = m.id
            ) alliances_data ON TRUE
            ${whereClause ?? ''}
            ORDER BY m.created_at DESC`
  }

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
          link TEXT,
          source VARCHAR(500),
          status VARCHAR(50) DEFAULT 'new',
          UNIQUE(id)
        )
      `)
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS countries (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS cities (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(name, country_id)
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS themes (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS tags (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS alliances (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS material_categories (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, category_id)
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS material_themes (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, theme_id)
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS material_tags (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, tag_id)
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS material_alliances (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, alliance_id)
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
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'summary'
          ) THEN
            ALTER TABLE materials ADD COLUMN summary TEXT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'link'
          ) THEN
            ALTER TABLE materials ADD COLUMN link TEXT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'country_id'
          ) THEN
            ALTER TABLE materials ADD COLUMN country_id INTEGER REFERENCES countries(id);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'city_id'
          ) THEN
            ALTER TABLE materials ADD COLUMN city_id INTEGER REFERENCES cities(id);
          END IF;
        END $$;
      `)
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status)
      `)
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_country ON materials(country_id)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_city ON materials(city_id)
      `)
      
      // Таблица для настроек
      await client.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) NOT NULL UNIQUE,
          value TEXT,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
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
            `INSERT INTO materials (id, title, content, full_content, thumbnail, author, created_at, fetched_at, link, source, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
               full_content = EXCLUDED.full_content,
               thumbnail = EXCLUDED.thumbnail,
               fetched_at = EXCLUDED.fetched_at,
               link = EXCLUDED.link`,
            [
              material.id,
              material.title,
              material.content,
              material.fullContent,
              material.thumbnail,
              material.author,
              material.createdAt,
              material.fetchedAt,
              material.link,
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

  async getAllMaterials(): Promise<Material[]> {
    const result = await pool.query(this.materialSelect())
 
    return result.rows
  }

  async getMaterialsByStatus(status: string): Promise<Material[]> {
    const result = await pool.query(this.materialSelect('WHERE m.status = $1'), [status])
 
    return result.rows
  }

  async getMaterialById(id: string): Promise<Material | null> {
    const result = await pool.query(this.materialSelect('WHERE m.id = $1'), [id])
    return result.rows[0] || null
  }

  async getTaxonomy(): Promise<{
    categories: Category[]
    themes: Theme[]
    tags: Tag[]
    alliances: Alliance[]
    countries: Array<Country & { cities: City[] }>
  }> {
    const [categoriesResult, themesResult, tagsResult, alliancesResult, countriesResult, citiesResult] = await Promise.all([
      pool.query('SELECT id, name FROM categories ORDER BY name ASC'),
      pool.query('SELECT id, name FROM themes ORDER BY name ASC'),
      pool.query('SELECT id, name FROM tags ORDER BY name ASC'),
      pool.query('SELECT id, name FROM alliances ORDER BY name ASC'),
      pool.query('SELECT id, name FROM countries ORDER BY name ASC'),
      pool.query('SELECT id, name, country_id AS "countryId" FROM cities ORDER BY name ASC'),
    ])

    const citiesByCountry = citiesResult.rows.reduce<Record<number, City[]>>((acc, city) => {
      if (!acc[city.countryId]) {
        acc[city.countryId] = []
      }
      acc[city.countryId].push(city)
      return acc
    }, {})

    const countriesWithCities = countriesResult.rows.map((country) => ({
      ...country,
      cities: citiesByCountry[country.id] ?? [],
    }))

    return {
      categories: categoriesResult.rows,
      themes: themesResult.rows,
      tags: tagsResult.rows,
      alliances: alliancesResult.rows,
      countries: countriesWithCities,
    }
  }

  async createTaxonomyItem(
    type: 'category' | 'theme' | 'tag' | 'alliance' | 'country' | 'city',
    name: string,
    options?: { countryId?: number }
  ) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Название не может быть пустым')
    }

    switch (type) {
      case 'category':
        return (await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING id, name', [trimmedName])).rows[0]
      case 'theme':
        return (await pool.query('INSERT INTO themes (name) VALUES ($1) RETURNING id, name', [trimmedName])).rows[0]
      case 'tag':
        return (await pool.query('INSERT INTO tags (name) VALUES ($1) RETURNING id, name', [trimmedName])).rows[0]
      case 'alliance':
        return (await pool.query('INSERT INTO alliances (name) VALUES ($1) RETURNING id, name', [trimmedName])).rows[0]
      case 'country':
        return (await pool.query('INSERT INTO countries (name) VALUES ($1) RETURNING id, name', [trimmedName])).rows[0]
      case 'city': {
        const countryId = options?.countryId
        if (!countryId) {
          throw new Error('Необходимо указать страну для города')
        }
        return (
          await pool.query(
            'INSERT INTO cities (name, country_id) VALUES ($1, $2) RETURNING id, name, country_id AS "countryId"',
            [trimmedName, countryId]
          )
        ).rows[0]
      }
      default:
        throw new Error('Неизвестный тип таксономии')
    }
  }

  async updateTaxonomyItem(
    type: 'category' | 'theme' | 'tag' | 'alliance' | 'country' | 'city',
    id: number,
    data: { name?: string; countryId?: number | null }
  ) {
    const trimmedName = data.name?.trim() ?? ''

    switch (type) {
      case 'category':
        if (!trimmedName) throw new Error('Название категории не может быть пустым')
        return (
          await pool.query(
            'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name',
            [trimmedName, id]
          )
        ).rows[0]
      case 'theme':
        if (!trimmedName) throw new Error('Название темы не может быть пустым')
        return (
          await pool.query(
            'UPDATE themes SET name = $1 WHERE id = $2 RETURNING id, name',
            [trimmedName, id]
          )
        ).rows[0]
      case 'tag':
        if (!trimmedName) throw new Error('Название тега не может быть пустым')
        return (
          await pool.query(
            'UPDATE tags SET name = $1 WHERE id = $2 RETURNING id, name',
            [trimmedName, id]
          )
        ).rows[0]
      case 'alliance':
        if (!trimmedName) throw new Error('Название союза не может быть пустым')
        return (
          await pool.query(
            'UPDATE alliances SET name = $1 WHERE id = $2 RETURNING id, name',
            [trimmedName, id]
          )
        ).rows[0]
      case 'country':
        if (!trimmedName) throw new Error('Название страны не может быть пустым')
        return (
          await pool.query(
            'UPDATE countries SET name = $1 WHERE id = $2 RETURNING id, name',
            [trimmedName, id]
          )
        ).rows[0]
      case 'city': {
        if (!trimmedName) throw new Error('Название города не может быть пустым')
        const countryId =
          data.countryId !== undefined && data.countryId !== null
            ? Number(data.countryId)
            : null
        if (!countryId) {
          throw new Error('Для города необходимо указать страну')
        }
        return (
          await pool.query(
            'UPDATE cities SET name = $1, country_id = $2 WHERE id = $3 RETURNING id, name, country_id AS "countryId"',
            [trimmedName, countryId, id]
          )
        ).rows[0]
      }
      default:
        throw new Error('Неизвестный тип таксономии')
    }
  }

  async deleteTaxonomyItem(
    type: 'category' | 'theme' | 'tag' | 'alliance' | 'country' | 'city',
    id: number
  ) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      switch (type) {
        case 'category':
          await client.query('DELETE FROM categories WHERE id = $1', [id])
          break
        case 'theme':
          await client.query('DELETE FROM themes WHERE id = $1', [id])
          break
        case 'tag':
          await client.query('DELETE FROM tags WHERE id = $1', [id])
          break
        case 'alliance':
          await client.query('DELETE FROM material_alliances WHERE alliance_id = $1', [id])
          await client.query('DELETE FROM alliances WHERE id = $1', [id])
          break
        case 'city':
          await client.query('UPDATE materials SET city_id = NULL WHERE city_id = $1', [id])
          await client.query('DELETE FROM cities WHERE id = $1', [id])
          break
        case 'country':
          await client.query(
            'UPDATE materials SET city_id = NULL WHERE city_id IN (SELECT id FROM cities WHERE country_id = $1)',
            [id]
          )
          await client.query('UPDATE materials SET country_id = NULL WHERE country_id = $1', [id])
          await client.query('DELETE FROM countries WHERE id = $1', [id])
          break
        default:
          throw new Error('Неизвестный тип таксономии')
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async updateMaterialTaxonomy(materialId: string, data: {
    categoryIds?: number[]
    themeIds?: number[]
    tagIds?: number[]
    allianceIds?: number[]
    countryId?: number | null
    cityId?: number | null
  }): Promise<void> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const shouldUpdateLocation = data.countryId !== undefined || data.cityId !== undefined
      if (shouldUpdateLocation) {
        let finalCountryId = data.countryId ?? null
        let finalCityId = data.cityId ?? null

        if (finalCityId !== null) {
          const cityResult = await client.query('SELECT country_id FROM cities WHERE id = $1', [finalCityId])
          const cityRow = cityResult.rows[0]
          if (!cityRow) {
            throw new Error('Указанный город не найден')
          }
          const cityCountryId: number = cityRow.country_id
          if (finalCountryId === null) {
            finalCountryId = cityCountryId
          } else if (finalCountryId !== cityCountryId) {
            throw new Error('Город не принадлежит выбранной стране')
          }
        }

        if (finalCountryId === null) {
          finalCityId = null
        }

        await client.query('UPDATE materials SET country_id = $1, city_id = $2 WHERE id = $3', [finalCountryId, finalCityId, materialId])
      }

      if (Array.isArray(data.categoryIds)) {
        await client.query('DELETE FROM material_categories WHERE material_id = $1', [materialId])
        for (const categoryId of data.categoryIds) {
          await client.query(
            'INSERT INTO material_categories (material_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [materialId, categoryId]
          )
        }
      }

      if (Array.isArray(data.themeIds)) {
        await client.query('DELETE FROM material_themes WHERE material_id = $1', [materialId])
        for (const themeId of data.themeIds) {
          await client.query(
            'INSERT INTO material_themes (material_id, theme_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [materialId, themeId]
          )
        }
      }

      if (Array.isArray(data.tagIds)) {
        await client.query('DELETE FROM material_tags WHERE material_id = $1', [materialId])
        for (const tagId of data.tagIds) {
          await client.query(
            'INSERT INTO material_tags (material_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [materialId, tagId]
          )
        }
      }

      if (Array.isArray(data.allianceIds)) {
        await client.query('DELETE FROM material_alliances WHERE material_id = $1', [materialId])
        for (const allianceId of data.allianceIds) {
          await client.query(
            'INSERT INTO material_alliances (material_id, alliance_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [materialId, allianceId]
          )
        }
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getCitiesByCountry(countryId: number): Promise<City[]> {
    const result = await pool.query(
      'SELECT id, name, country_id AS "countryId" FROM cities WHERE country_id = $1 ORDER BY name ASC',
      [countryId]
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

  async updateFeedTitle(id: number, title: string) {
    await pool.query(
      'UPDATE feeds SET title = $1 WHERE id = $2',
      [title, id]
    )
  }

  async deleteFeed(id: number) {
    await pool.query(
      'UPDATE feeds SET status = $1 WHERE id = $2',
      ['deleted', id]
    )
  }

  // Settings methods
  async getSetting(key: string): Promise<string | null> {
    const result = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      [key]
    )
    return result.rows[0]?.value || null
  }

  async setSetting(key: string, value: string): Promise<void> {
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    )
  }

  async getSettings(): Promise<Record<string, string>> {
    const result = await pool.query('SELECT key, value FROM settings')
    const settings: Record<string, string> = {}
    result.rows.forEach(row => {
      settings[row.key] = row.value
    })
    return settings
  }

  // Material summary methods
  async updateMaterialSummary(id: string, summary: string): Promise<void> {
    await pool.query(
      'UPDATE materials SET summary = $1 WHERE id = $2',
      [summary, id]
    )
  }

  async getMaterialSummary(id: string): Promise<string | null> {
    const result = await pool.query(
      'SELECT summary FROM materials WHERE id = $1',
      [id]
    )
    return result.rows[0]?.summary || null
  }
}

export const db = new DatabaseService()
