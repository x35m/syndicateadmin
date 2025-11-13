import { Pool } from 'pg'
import { Material, Category, Country, City, CategorizationLog } from './types'

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
                   m.processed,
                   m.published,
                   m.summary,
                   m.meta_description AS "metaDescription",
                   m.sentiment,
                   m.content_type AS "contentType",
                   f.title AS "feedName",
                   COALESCE(
                     (SELECT json_agg(json_build_object('id', c.id, 'name', c.name))
                      FROM material_countries mc
                      JOIN countries c ON mc.country_id = c.id
                      WHERE mc.material_id = m.id),
                     '[]'::json
                   ) AS countries_data,
                   COALESCE(
                     (SELECT json_agg(json_build_object('id', ci.id, 'name', ci.name, 'countryId', ci.country_id))
                      FROM material_cities mci
                      JOIN cities ci ON mci.city_id = ci.id
                      WHERE mci.material_id = m.id),
                     '[]'::json
                   ) AS cities_data,
                   categories_data.categories
            FROM materials m
            LEFT JOIN feeds f ON m.source = f.url
            LEFT JOIN LATERAL (
              SELECT COALESCE(
                json_agg(
             json_build_object('id', cat.id, 'name', cat.name, 'isHidden', cat.is_hidden)
                  ORDER BY cat.name
                ),
                '[]'::json
              ) AS categories
              FROM material_categories mc
              JOIN categories cat ON cat.id = mc.category_id
              WHERE mc.material_id = m.id
            ) categories_data ON TRUE
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
          is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)

      await client.query(`
        ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS categorization_logs (
          id SERIAL PRIMARY KEY,
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          supercategory TEXT,
          predicted_category TEXT,
          validation_category TEXT,
          confidence NUMERIC,
          validation_confidence NUMERIC,
          reasoning JSONB,
          metadata JSONB,
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
        CREATE TABLE IF NOT EXISTS material_countries (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, country_id)
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS material_cities (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, city_id)
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

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'meta_description'
          ) THEN
            ALTER TABLE materials ADD COLUMN meta_description TEXT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'sentiment'
          ) THEN
            ALTER TABLE materials ADD COLUMN sentiment VARCHAR(20);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'content_type'
          ) THEN
            ALTER TABLE materials ADD COLUMN content_type VARCHAR(50);
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'processed'
          ) THEN
            ALTER TABLE materials ADD COLUMN processed BOOLEAN NOT NULL DEFAULT FALSE;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'materials' AND column_name = 'published'
          ) THEN
            ALTER TABLE materials ADD COLUMN published BOOLEAN NOT NULL DEFAULT FALSE;
          END IF;
        END $$;
      `)
      
      // Инициализируем новые статусы на основе существующего поля status
      await client.query(`
        UPDATE materials 
        SET processed = TRUE 
        WHERE status IN ('processed', 'published') AND processed IS DISTINCT FROM TRUE
      `)

      await client.query(`
        UPDATE materials 
        SET published = TRUE 
        WHERE status = 'published' AND published IS DISTINCT FROM TRUE
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

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_summary ON materials(summary) WHERE summary IS NOT NULL
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_source ON materials(source)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_processed ON materials(processed)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_published ON materials(published)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_material_categories_material ON material_categories(material_id)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_material_categories_category ON material_categories(category_id)
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

  async saveMaterials(materials: Material[]): Promise<{ new: number; updated: number; errors: number; newMaterials: Material[] }> {
    if (materials.length === 0) return { new: 0, updated: 0, errors: 0, newMaterials: [] }

    const client = await pool.connect()
    let newCount = 0
    let updatedCount = 0
    let errorCount = 0
    const newMaterialIds: string[] = []

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
            newMaterialIds.push(material.id)
          }
        } catch (error) {
          console.error(`Error saving material ${material.id}:`, error)
          errorCount++
        }
      }

      await client.query('COMMIT')

      // Load new materials with full taxonomy
      const newMaterials: Material[] = []
      if (newMaterialIds.length > 0) {
        const placeholders = newMaterialIds.map((_, i) => `$${i + 1}`).join(',')
        const newMaterialsResult = await pool.query(
          `${this.materialSelect(`WHERE m.id IN (${placeholders})`)}`,
          newMaterialIds
        )
        newMaterials.push(...newMaterialsResult.rows.map(row => this.transformMaterialRow(row)))
      }

      return { new: newCount, updated: updatedCount, errors: errorCount, newMaterials }
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Error in saveMaterials:', error)
      throw error
    } finally {
      client.release()
    }
  }

  private transformMaterialRow(row: any): Material {
    const categories = Array.isArray(row.categories)
      ? row.categories.map((category: any) => ({
          ...category,
          isHidden: Boolean(category.isHidden),
        }))
      : []

    return {
      ...row,
      processed: Boolean(row.processed),
      published: Boolean(row.published),
      categories,
      countries: row.countries_data || [],
      cities: row.cities_data || [],
    }
  }

  async getAllMaterials(): Promise<Material[]> {
    const result = await pool.query(this.materialSelect())
    return result.rows.map(row => this.transformMaterialRow(row))
  }

  async getMaterialsByStatus(status: string): Promise<Material[]> {
    let clause = ''
    let params: any[] = []

    switch (status) {
      case 'processed':
        clause = "WHERE m.status = 'processed'"
        break
      case 'published':
        clause = "WHERE m.status = 'published'"
        break
      case 'archived':
        clause = 'WHERE m.status = $1'
        params = ['archived']
        break
      case 'new':
        clause = "WHERE m.status = 'new'"
        break
      case 'all':
        return this.getAllMaterials()
      default:
        clause = 'WHERE m.status = $1'
        params = [status]
        break
    }

    const result = await pool.query(this.materialSelect(clause), params)
    return result.rows.map(row => this.transformMaterialRow(row))
  }

  async getMaterialsPaginated(options: {
    page?: number
    pageSize?: number
    status?: string
    search?: string
    categoryIds?: number[]
    countryIds?: number[]
    cityIds?: number[]
    feedNames?: string[]
  }): Promise<{ materials: Material[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const page = options.page || 1
    const pageSize = options.pageSize || 50
    const offset = (page - 1) * pageSize

    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Status filter
    if (options.status && options.status !== 'all') {
      if (options.status === 'processed') {
        conditions.push("m.status = 'processed'")
      } else if (options.status === 'published') {
        conditions.push("m.status = 'published'")
      } else if (options.status === 'new') {
        conditions.push("m.status = 'new'")
      } else {
        conditions.push(`m.status = $${paramIndex}`)
        params.push(options.status)
        paramIndex++
      }
    }

    // Search filter
    if (options.search && options.search.trim()) {
      conditions.push(`(m.title ILIKE $${paramIndex} OR m.content ILIKE $${paramIndex} OR m.full_content ILIKE $${paramIndex})`)
      params.push(`%${options.search.trim()}%`)
      paramIndex++
    }

    // Category filter
    if (options.categoryIds && options.categoryIds.length > 0) {
      conditions.push(`EXISTS (
        SELECT 1 FROM material_categories mc 
        WHERE mc.material_id = m.id 
        AND mc.category_id = ANY($${paramIndex}::int[])
      )`)
      params.push(options.categoryIds)
      paramIndex++
    }

    // Country filter
    if (options.countryIds && options.countryIds.length > 0) {
      conditions.push(`EXISTS (
        SELECT 1 FROM material_countries mc 
        WHERE mc.material_id = m.id 
        AND mc.country_id = ANY($${paramIndex}::int[])
      )`)
      params.push(options.countryIds)
      paramIndex++
    }

    // City filter
    if (options.cityIds && options.cityIds.length > 0) {
      conditions.push(`EXISTS (
        SELECT 1 FROM material_cities mci 
        WHERE mci.material_id = m.id 
        AND mci.city_id = ANY($${paramIndex}::int[])
      )`)
      params.push(options.cityIds)
      paramIndex++
    }

    // Feed filter
    if (options.feedNames && options.feedNames.length > 0) {
      conditions.push(`(f.title = ANY($${paramIndex}::text[]) OR m.source = ANY($${paramIndex}::text[]))`)
      params.push(options.feedNames)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM materials m LEFT JOIN feeds f ON m.source = f.url ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total)

    // Get paginated materials
    const materialsResult = await pool.query(
      `${this.materialSelect(whereClause)} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    )

    return {
      materials: materialsResult.rows.map(row => this.transformMaterialRow(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async getMaterialById(id: string): Promise<Material | null> {
    const result = await pool.query(this.materialSelect('WHERE m.id = $1'), [id])
    return result.rows[0] ? this.transformMaterialRow(result.rows[0]) : null
  }

  async getTaxonomy(): Promise<{
    categories: Category[]
    countries: Array<Country & { cities: City[] }>
  }> {
    const [categoriesResult, countriesResult, citiesResult] = await Promise.all([
      pool.query('SELECT id, name, is_hidden AS "isHidden" FROM categories ORDER BY name ASC'),
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
      countries: countriesWithCities,
    }
  }

  async createTaxonomyItem(
    type: 'category' | 'country' | 'city',
    name: string,
    options?: { countryId?: number }
  ) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Название не может быть пустым')
    }

    switch (type) {
      case 'category':
        return (
          await pool.query(
            'INSERT INTO categories (name) VALUES ($1) RETURNING id, name, is_hidden AS "isHidden"',
            [trimmedName]
          )
        ).rows[0]
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
    type: 'category' | 'country' | 'city',
    id: number,
    data: { name?: string; countryId?: number | null; isHidden?: boolean }
  ) {
    const trimmedName = data.name?.trim()

    switch (type) {
      case 'category': {
        const updates: string[] = []
        const values: any[] = []
        let paramIndex = 1

        if (trimmedName !== undefined) {
          if (!trimmedName) throw new Error('Название категории не может быть пустым')
          updates.push(`name = $${paramIndex}`)
          values.push(trimmedName)
          paramIndex++
        }

        if (typeof data.isHidden === 'boolean') {
          updates.push(`is_hidden = $${paramIndex}`)
          values.push(data.isHidden)
          paramIndex++
        }

        if (updates.length === 0) {
          throw new Error('Нет данных для обновления категории')
        }

        return (
          await pool.query(
            `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, is_hidden AS "isHidden"`,
            [...values, id]
          )
        ).rows[0]
      }
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
    type: 'category' | 'country' | 'city',
    id: number
  ) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      switch (type) {
        case 'category':
          await client.query('DELETE FROM categories WHERE id = $1', [id])
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
    countryIds?: number[]
    cityIds?: number[]
  }): Promise<void> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

        await client.query('DELETE FROM material_categories WHERE material_id = $1', [materialId])
      await client.query('DELETE FROM material_countries WHERE material_id = $1', [materialId])
      await client.query('DELETE FROM material_cities WHERE material_id = $1', [materialId])

      if (data.categoryIds && data.categoryIds.length > 0) {
        for (const categoryId of data.categoryIds) {
          await client.query(
            'INSERT INTO material_categories (material_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [materialId, categoryId]
          )
        }
      }

      if (data.countryIds && data.countryIds.length > 0) {
        for (const countryId of data.countryIds) {
          await client.query(
            'INSERT INTO material_countries (material_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [materialId, countryId]
          )
        }
      }

      if (data.cityIds && data.cityIds.length > 0) {
        for (const cityId of data.cityIds) {
          await client.query(
            'INSERT INTO material_cities (material_id, city_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [materialId, cityId]
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

  async deleteMaterial(id: string): Promise<void> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM material_categories WHERE material_id = $1', [id])
      await client.query('DELETE FROM material_countries WHERE material_id = $1', [id])
      await client.query('DELETE FROM material_cities WHERE material_id = $1', [id])
      await client.query('DELETE FROM categorization_logs WHERE material_id = $1', [id])
      await client.query('DELETE FROM materials WHERE id = $1', [id])
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

  async updateMaterialAttributes(
    id: string,
    attributes: { status?: string; processed?: boolean; published?: boolean }
  ): Promise<void> {
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (attributes.status !== undefined) {
      updates.push(`status = $${paramIndex}`)
      values.push(attributes.status)
      paramIndex++
    }

    if (attributes.processed !== undefined) {
      updates.push(`processed = $${paramIndex}`)
      values.push(attributes.processed)
      paramIndex++
    }

    if (attributes.published !== undefined) {
      updates.push(`published = $${paramIndex}`)
      values.push(attributes.published)
      paramIndex++
    }

    if (updates.length === 0) {
      return
    }

    values.push(id)

    await pool.query(
      `UPDATE materials SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
      values
    )
  }

  async getStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'processed') as processed_count,
        COUNT(*) FILTER (WHERE status = 'published') as published_count,
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
  async updateMaterialSummary(
    id: string,
    data: {
      summary?: string
      metaDescription?: string
      sentiment?: 'positive' | 'neutral' | 'negative'
      contentType?: 'purely_factual' | 'mostly_factual' | 'balanced' | 'mostly_opinion' | 'purely_opinion'
      setProcessed?: boolean
    }
  ): Promise<void> {
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (data.summary !== undefined) {
      updates.push(`summary = $${paramIndex}`)
      values.push(data.summary)
      paramIndex++
    }
    if (data.metaDescription !== undefined) {
      updates.push(`meta_description = $${paramIndex}`)
      values.push(data.metaDescription)
      paramIndex++
    }
    if (data.sentiment !== undefined) {
      updates.push(`sentiment = $${paramIndex}`)
      values.push(data.sentiment)
      paramIndex++
    }
    if (data.contentType !== undefined) {
      updates.push(`content_type = $${paramIndex}`)
      values.push(data.contentType)
      paramIndex++
    }
    if (data.setProcessed === true) {
      updates.push('processed = TRUE')
      updates.push(`status = CASE
        WHEN status = 'archived' THEN status
        WHEN status = 'published' THEN status
        ELSE 'processed'
      END`)
    }

    if (updates.length > 0) {
      values.push(id)
    await pool.query(
        `UPDATE materials SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      )
    }
  }

  async getCategoryExamples(limit = 15): Promise<Array<{
    id: string
    title: string
    summary: string | null
    content: string | null
    category: string
  }>> {
    const result = await pool.query(
      `
      SELECT 
        m.id,
        m.title,
        m.summary,
        m.content,
        c.name AS category
      FROM materials m
      JOIN material_categories mc ON mc.material_id = m.id
      JOIN categories c ON c.id = mc.category_id
      WHERE m.summary IS NOT NULL
      ORDER BY m.created_at DESC
      LIMIT $1
      `,
      [limit]
    )

    return result.rows
  }

  async createCategorizationLog(data: {
    materialId: string
    supercategory?: string
    predictedCategory?: string
    validationCategory?: string
    confidence?: number
    validationConfidence?: number
    reasoning?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }): Promise<void> {
    await pool.query(
      `
      INSERT INTO categorization_logs (
        material_id,
        supercategory,
        predicted_category,
        validation_category,
        confidence,
        validation_confidence,
        reasoning,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        data.materialId,
        data.supercategory ?? null,
        data.predictedCategory ?? null,
        data.validationCategory ?? null,
        data.confidence ?? null,
        data.validationConfidence ?? null,
        data.reasoning ? JSON.stringify(data.reasoning) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    )
  }

  async getCategorizationLogs(limit = 100): Promise<CategorizationLog[]> {
    const result = await pool.query(
      `
      SELECT 
        cl.id,
        cl.material_id AS "materialId",
        cl.supercategory,
        cl.predicted_category AS "predictedCategory",
        cl.validation_category AS "validationCategory",
        cl.confidence,
        cl.validation_confidence AS "validationConfidence",
        cl.reasoning,
        cl.metadata,
        cl.created_at AS "createdAt",
        m.title
      FROM categorization_logs cl
      LEFT JOIN materials m ON m.id = cl.material_id
      ORDER BY cl.created_at DESC
      LIMIT $1
      `,
      [limit]
    )

    return result.rows.map((row) => {
      let reasoning: Record<string, unknown> | null = null
      let metadata: Record<string, unknown> | null = null

      try {
        reasoning = row.reasoning ? JSON.parse(row.reasoning) : null
      } catch (error) {
        console.warn('Failed to parse categorization log reasoning:', error)
      }

      try {
        metadata = row.metadata ? JSON.parse(row.metadata) : null
      } catch (error) {
        console.warn('Failed to parse categorization log metadata:', error)
      }

      return {
        id: row.id,
        materialId: row.materialId,
        title: row.title,
        supercategory: row.supercategory,
        predictedCategory: row.predictedCategory,
        validationCategory: row.validationCategory,
        confidence: row.confidence !== null ? Number(row.confidence) : null,
        validationConfidence:
          row.validationConfidence !== null ? Number(row.validationConfidence) : null,
        reasoning,
        metadata,
        createdAt: row.createdAt,
      }
    })
  }
}

export const db = new DatabaseService()