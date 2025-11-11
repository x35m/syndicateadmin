"use strict";exports.id=487,exports.ids=[487],exports.modules={9487:(a,e,t)=>{t.d(e,{db:()=>r});let E=new(t(5900)).Pool({connectionString:process.env.DATABASE_URL||process.env.DATABASE_PUBLIC_URL,ssl:{rejectUnauthorized:!1}});class i{materialSelect(a){return`SELECT m.id,
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
            ${a??""}
            ORDER BY m.created_at DESC`}async init(){let a=await E.connect();try{await a.query(`
        CREATE TABLE IF NOT EXISTS feeds (
          id SERIAL PRIMARY KEY,
          url TEXT NOT NULL UNIQUE,
          title TEXT,
          description TEXT,
          last_fetched TIMESTAMP,
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status)
      `),await a.query(`
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
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS countries (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS cities (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(name, country_id)
        )
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS themes (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS tags (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS alliances (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS material_categories (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, category_id)
        )
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS material_themes (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, theme_id)
        )
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS material_tags (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, tag_id)
        )
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS material_alliances (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, alliance_id)
        )
      `),await a.query(`
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
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_country ON materials(country_id)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_city ON materials(city_id)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_summary ON materials(summary) WHERE summary IS NOT NULL
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_source ON materials(source)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_material_categories_material ON material_categories(material_id)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_material_categories_category ON material_categories(category_id)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_material_themes_material ON material_themes(material_id)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_material_themes_theme ON material_themes(theme_id)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_material_tags_material ON material_tags(material_id)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_material_tags_tag ON material_tags(tag_id)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_material_alliances_material ON material_alliances(material_id)
      `),await a.query(`
        CREATE INDEX IF NOT EXISTS idx_material_alliances_alliance ON material_alliances(alliance_id)
      `),await a.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) NOT NULL UNIQUE,
          value TEXT,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),console.log("Database initialized successfully")}finally{a.release()}}async saveMaterials(a){if(0===a.length)return{new:0,updated:0,errors:0,newMaterials:[]};let e=await E.connect(),t=0,i=0,r=0,s=[];try{for(let E of(await e.query("BEGIN"),a))try{let a=(await e.query("SELECT id FROM materials WHERE id = $1",[E.id])).rows.length>0;await e.query(`INSERT INTO materials (id, title, content, full_content, thumbnail, author, created_at, fetched_at, link, source, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
               full_content = EXCLUDED.full_content,
               thumbnail = EXCLUDED.thumbnail,
               fetched_at = EXCLUDED.fetched_at,
               link = EXCLUDED.link`,[E.id,E.title,E.content,E.fullContent,E.thumbnail,E.author,E.createdAt,E.fetchedAt,E.link,E.source,E.status]),a?i++:(t++,s.push(E.id))}catch(a){console.error(`Error saving material ${E.id}:`,a),r++}await e.query("COMMIT");let T=[];if(s.length>0){let a=s.map((a,e)=>`$${e+1}`).join(","),e=await E.query(`${this.materialSelect(`WHERE m.id IN (${a})`)}`,s);T.push(...e.rows)}return{new:t,updated:i,errors:r,newMaterials:T}}catch(a){throw await e.query("ROLLBACK"),console.error("Error in saveMaterials:",a),a}finally{e.release()}}async getAllMaterials(){return(await E.query(this.materialSelect())).rows}async getMaterialsByStatus(a){return(await E.query(this.materialSelect("WHERE m.status = $1"),[a])).rows}async getMaterialsPaginated(a){let e=a.page||1,t=a.pageSize||50,i=[],r=[],s=1;a.status&&"all"!==a.status&&(i.push(`m.status = $${s}`),r.push(a.status),s++),a.search&&a.search.trim()&&(i.push(`(m.title ILIKE $${s} OR m.content ILIKE $${s} OR m.full_content ILIKE $${s})`),r.push(`%${a.search.trim()}%`),s++),a.categoryIds&&a.categoryIds.length>0&&(i.push(`EXISTS (
        SELECT 1 FROM material_categories mc 
        WHERE mc.material_id = m.id 
        AND mc.category_id = ANY($${s}::int[])
      )`),r.push(a.categoryIds),s++),a.themeIds&&a.themeIds.length>0&&(i.push(`EXISTS (
        SELECT 1 FROM material_themes mth 
        WHERE mth.material_id = m.id 
        AND mth.theme_id = ANY($${s}::int[])
      )`),r.push(a.themeIds),s++),a.tagIds&&a.tagIds.length>0&&(i.push(`EXISTS (
        SELECT 1 FROM material_tags mtg 
        WHERE mtg.material_id = m.id 
        AND mtg.tag_id = ANY($${s}::int[])
      )`),r.push(a.tagIds),s++),a.allianceIds&&a.allianceIds.length>0&&(i.push(`EXISTS (
        SELECT 1 FROM material_alliances ma 
        WHERE ma.material_id = m.id 
        AND ma.alliance_id = ANY($${s}::int[])
      )`),r.push(a.allianceIds),s++),a.countryIds&&a.countryIds.length>0&&(i.push(`m.country_id = ANY($${s}::int[])`),r.push(a.countryIds),s++),a.cityIds&&a.cityIds.length>0&&(i.push(`m.city_id = ANY($${s}::int[])`),r.push(a.cityIds),s++),a.feedNames&&a.feedNames.length>0&&(i.push(`(f.title = ANY($${s}::text[]) OR m.source = ANY($${s}::text[]))`),r.push(a.feedNames),s++),a.onlyWithSummary&&i.push("m.summary IS NOT NULL AND m.summary != ''");let T=i.length>0?`WHERE ${i.join(" AND ")}`:"",l=parseInt((await E.query(`SELECT COUNT(*) as total FROM materials m LEFT JOIN feeds f ON m.source = f.url ${T}`,r)).rows[0].total);return{materials:(await E.query(`${this.materialSelect(T)} LIMIT $${s} OFFSET $${s+1}`,[...r,t,(e-1)*t])).rows,total:l,page:e,pageSize:t,totalPages:Math.ceil(l/t)}}async getMaterialById(a){return(await E.query(this.materialSelect("WHERE m.id = $1"),[a])).rows[0]||null}async getTaxonomy(){let[a,e,t,i,r,s]=await Promise.all([E.query("SELECT id, name FROM categories ORDER BY name ASC"),E.query("SELECT id, name FROM themes ORDER BY name ASC"),E.query("SELECT id, name FROM tags ORDER BY name ASC"),E.query("SELECT id, name FROM alliances ORDER BY name ASC"),E.query("SELECT id, name FROM countries ORDER BY name ASC"),E.query('SELECT id, name, country_id AS "countryId" FROM cities ORDER BY name ASC')]),T=s.rows.reduce((a,e)=>(a[e.countryId]||(a[e.countryId]=[]),a[e.countryId].push(e),a),{}),l=r.rows.map(a=>({...a,cities:T[a.id]??[]}));return{categories:a.rows,themes:e.rows,tags:t.rows,alliances:i.rows,countries:l}}async createTaxonomyItem(a,e,t){let i=e.trim();if(!i)throw Error("Название не может быть пустым");switch(a){case"category":return(await E.query("INSERT INTO categories (name) VALUES ($1) RETURNING id, name",[i])).rows[0];case"theme":return(await E.query("INSERT INTO themes (name) VALUES ($1) RETURNING id, name",[i])).rows[0];case"tag":return(await E.query("INSERT INTO tags (name) VALUES ($1) RETURNING id, name",[i])).rows[0];case"alliance":return(await E.query("INSERT INTO alliances (name) VALUES ($1) RETURNING id, name",[i])).rows[0];case"country":return(await E.query("INSERT INTO countries (name) VALUES ($1) RETURNING id, name",[i])).rows[0];case"city":{let a=t?.countryId;if(!a)throw Error("Необходимо указать страну для города");return(await E.query('INSERT INTO cities (name, country_id) VALUES ($1, $2) RETURNING id, name, country_id AS "countryId"',[i,a])).rows[0]}default:throw Error("Неизвестный тип таксономии")}}async updateTaxonomyItem(a,e,t){let i=t.name?.trim()??"";switch(a){case"category":if(!i)throw Error("Название категории не может быть пустым");return(await E.query("UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name",[i,e])).rows[0];case"theme":if(!i)throw Error("Название темы не может быть пустым");return(await E.query("UPDATE themes SET name = $1 WHERE id = $2 RETURNING id, name",[i,e])).rows[0];case"tag":if(!i)throw Error("Название тега не может быть пустым");return(await E.query("UPDATE tags SET name = $1 WHERE id = $2 RETURNING id, name",[i,e])).rows[0];case"alliance":if(!i)throw Error("Название союза не может быть пустым");return(await E.query("UPDATE alliances SET name = $1 WHERE id = $2 RETURNING id, name",[i,e])).rows[0];case"country":if(!i)throw Error("Название страны не может быть пустым");return(await E.query("UPDATE countries SET name = $1 WHERE id = $2 RETURNING id, name",[i,e])).rows[0];case"city":{if(!i)throw Error("Название города не может быть пустым");let a=void 0!==t.countryId&&null!==t.countryId?Number(t.countryId):null;if(!a)throw Error("Для города необходимо указать страну");return(await E.query('UPDATE cities SET name = $1, country_id = $2 WHERE id = $3 RETURNING id, name, country_id AS "countryId"',[i,a,e])).rows[0]}default:throw Error("Неизвестный тип таксономии")}}async deleteTaxonomyItem(a,e){let t=await E.connect();try{switch(await t.query("BEGIN"),a){case"category":await t.query("DELETE FROM categories WHERE id = $1",[e]);break;case"theme":await t.query("DELETE FROM themes WHERE id = $1",[e]);break;case"tag":await t.query("DELETE FROM tags WHERE id = $1",[e]);break;case"alliance":await t.query("DELETE FROM material_alliances WHERE alliance_id = $1",[e]),await t.query("DELETE FROM alliances WHERE id = $1",[e]);break;case"city":await t.query("UPDATE materials SET city_id = NULL WHERE city_id = $1",[e]),await t.query("DELETE FROM cities WHERE id = $1",[e]);break;case"country":await t.query("UPDATE materials SET city_id = NULL WHERE city_id IN (SELECT id FROM cities WHERE country_id = $1)",[e]),await t.query("UPDATE materials SET country_id = NULL WHERE country_id = $1",[e]),await t.query("DELETE FROM countries WHERE id = $1",[e]);break;default:throw Error("Неизвестный тип таксономии")}await t.query("COMMIT")}catch(a){throw await t.query("ROLLBACK"),a}finally{t.release()}}async updateMaterialTaxonomy(a,e){let t=await E.connect();try{if(await t.query("BEGIN"),void 0!==e.countryId||void 0!==e.cityId){let E=e.countryId??null,i=e.cityId??null;if(null!==i){let a=(await t.query("SELECT country_id FROM cities WHERE id = $1",[i])).rows[0];if(!a)throw Error("Указанный город не найден");let e=a.country_id;if(null===E)E=e;else if(E!==e)throw Error("Город не принадлежит выбранной стране")}null===E&&(i=null),await t.query("UPDATE materials SET country_id = $1, city_id = $2 WHERE id = $3",[E,i,a])}if(Array.isArray(e.categoryIds))for(let E of(await t.query("DELETE FROM material_categories WHERE material_id = $1",[a]),e.categoryIds))await t.query("INSERT INTO material_categories (material_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[a,E]);if(Array.isArray(e.themeIds))for(let E of(await t.query("DELETE FROM material_themes WHERE material_id = $1",[a]),e.themeIds))await t.query("INSERT INTO material_themes (material_id, theme_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[a,E]);if(Array.isArray(e.tagIds))for(let E of(await t.query("DELETE FROM material_tags WHERE material_id = $1",[a]),e.tagIds))await t.query("INSERT INTO material_tags (material_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[a,E]);if(Array.isArray(e.allianceIds))for(let E of(await t.query("DELETE FROM material_alliances WHERE material_id = $1",[a]),e.allianceIds))await t.query("INSERT INTO material_alliances (material_id, alliance_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[a,E]);await t.query("COMMIT")}catch(a){throw await t.query("ROLLBACK"),a}finally{t.release()}}async getCitiesByCountry(a){return(await E.query('SELECT id, name, country_id AS "countryId" FROM cities WHERE country_id = $1 ORDER BY name ASC',[a])).rows}async updateMaterialStatus(a,e){await E.query("UPDATE materials SET status = $1 WHERE id = $2",[e,a])}async deleteMaterial(a){await E.query("DELETE FROM materials WHERE id = $1",[a])}async getStats(){return(await E.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'processed') as processed_count,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
        MAX(fetched_at) as last_fetch
      FROM materials
    `)).rows[0]}async close(){await E.end()}async addFeed(a,e,t){return(await E.query(`INSERT INTO feeds (url, title, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (url) DO UPDATE SET
         title = COALESCE(EXCLUDED.title, feeds.title),
         description = COALESCE(EXCLUDED.description, feeds.description)
       RETURNING *`,[a,e,t])).rows[0]}async getAllFeeds(){return(await E.query(`SELECT id, url, title, description, last_fetched as "lastFetched", status, created_at as "createdAt"
       FROM feeds
       WHERE status = 'active'
       ORDER BY created_at DESC`)).rows}async getFeedById(a){return(await E.query(`SELECT id, url, title, description, last_fetched as "lastFetched", status, created_at as "createdAt"
       FROM feeds
       WHERE id = $1`,[a])).rows[0]}async updateFeedFetchTime(a){await E.query("UPDATE feeds SET last_fetched = NOW() WHERE id = $1",[a])}async updateFeedTitle(a,e){await E.query("UPDATE feeds SET title = $1 WHERE id = $2",[e,a])}async deleteFeed(a){await E.query("UPDATE feeds SET status = $1 WHERE id = $2",["deleted",a])}async getSetting(a){let e=await E.query("SELECT value FROM settings WHERE key = $1",[a]);return e.rows[0]?.value||null}async setSetting(a,e){await E.query(`INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = NOW()`,[a,e])}async getSettings(){let a=await E.query("SELECT key, value FROM settings"),e={};return a.rows.forEach(a=>{e[a.key]=a.value}),e}async updateMaterialSummary(a,e){await E.query("UPDATE materials SET summary = $1 WHERE id = $2",[e,a])}async getMaterialSummary(a){let e=await E.query("SELECT summary FROM materials WHERE id = $1",[a]);return e.rows[0]?.summary||null}}let r=new i}};