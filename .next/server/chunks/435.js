"use strict";exports.id=435,exports.ids=[435],exports.modules={9487:(e,t,a)=>{a.d(t,{db:()=>s});let i=new(a(5900)).Pool({connectionString:process.env.DATABASE_URL||process.env.DATABASE_PUBLIC_URL,ssl:{rejectUnauthorized:!1}});class r{materialSelect(e){return`SELECT m.id,
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
            ${e??""}
            ORDER BY m.created_at DESC`}async init(){let e=await i.connect();try{await e.query(`
        CREATE TABLE IF NOT EXISTS feeds (
          id SERIAL PRIMARY KEY,
          url TEXT NOT NULL UNIQUE,
          title TEXT,
          description TEXT,
          last_fetched TIMESTAMP,
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status)
      `),await e.query(`
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
      `),await e.query(`
        CREATE TABLE IF NOT EXISTS countries (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await e.query(`
        CREATE TABLE IF NOT EXISTS cities (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(name, country_id)
        )
      `),await e.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await e.query(`
        ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE
      `),await e.query(`
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
      `),await e.query(`
        CREATE TABLE IF NOT EXISTS system_logs (
          id SERIAL PRIMARY KEY,
          level VARCHAR(32) NOT NULL DEFAULT 'error',
          source TEXT,
          message TEXT NOT NULL,
          details JSONB,
          stack TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC)
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)
      `),await e.query(`
        CREATE TABLE IF NOT EXISTS material_categories (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, category_id)
        )
      `),await e.query(`
        CREATE TABLE IF NOT EXISTS material_countries (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, country_id)
        )
      `),await e.query(`
        CREATE TABLE IF NOT EXISTS material_cities (
          material_id VARCHAR(255) NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
          PRIMARY KEY (material_id, city_id)
        )
      `),await e.query(`
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
      `),await e.query(`
        UPDATE materials 
        SET processed = TRUE 
        WHERE status IN ('processed', 'published') AND processed IS DISTINCT FROM TRUE
      `),await e.query(`
        UPDATE materials 
        SET published = TRUE 
        WHERE status = 'published' AND published IS DISTINCT FROM TRUE
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status)
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC)
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_country ON materials(country_id)
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_city ON materials(city_id)
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_summary ON materials(summary) WHERE summary IS NOT NULL
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_source ON materials(source)
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_processed ON materials(processed)
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_published ON materials(published)
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_material_categories_material ON material_categories(material_id)
      `),await e.query(`
        CREATE INDEX IF NOT EXISTS idx_material_categories_category ON material_categories(category_id)
      `),await e.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) NOT NULL UNIQUE,
          value TEXT,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),console.log("Database initialized successfully")}finally{e.release()}}async saveMaterials(e){if(0===e.length)return{new:0,updated:0,errors:0,newMaterials:[]};let t=await i.connect(),a=0,r=0,s=0,E=[];try{for(let i of(await t.query("BEGIN"),e))try{let e=(await t.query("SELECT id FROM materials WHERE id = $1",[i.id])).rows.length>0;await t.query(`INSERT INTO materials (id, title, content, full_content, thumbnail, author, created_at, fetched_at, link, source, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
               full_content = EXCLUDED.full_content,
               thumbnail = EXCLUDED.thumbnail,
               fetched_at = EXCLUDED.fetched_at,
               link = EXCLUDED.link`,[i.id,i.title,i.content,i.fullContent,i.thumbnail,i.author,i.createdAt,i.fetchedAt,i.link,i.source,i.status]),e?r++:(a++,E.push(i.id))}catch(e){console.error(`Error saving material ${i.id}:`,e),s++}await t.query("COMMIT");let n=[];if(E.length>0){let e=E.map((e,t)=>`$${t+1}`).join(","),t=await i.query(`${this.materialSelect(`WHERE m.id IN (${e})`)}`,E);n.push(...t.rows.map(e=>this.transformMaterialRow(e)))}return{new:a,updated:r,errors:s,newMaterials:n}}catch(e){throw await t.query("ROLLBACK"),console.error("Error in saveMaterials:",e),e}finally{t.release()}}transformMaterialRow(e){let t=Array.isArray(e.categories)?e.categories.map(e=>({...e,isHidden:!!e.isHidden})):[];return{...e,processed:!!e.processed,published:!!e.published,categories:t,countries:e.countries_data||[],cities:e.cities_data||[]}}async getAllMaterials(){return(await i.query(this.materialSelect())).rows.map(e=>this.transformMaterialRow(e))}async getMaterialsByStatus(e){let t="",a=[];switch(e){case"processed":t="WHERE m.status = 'processed'";break;case"published":t="WHERE m.status = 'published'";break;case"archived":t="WHERE m.status = $1",a=["archived"];break;case"new":t="WHERE m.status = 'new'";break;case"all":return this.getAllMaterials();default:t="WHERE m.status = $1",a=[e]}return(await i.query(this.materialSelect(t),a)).rows.map(e=>this.transformMaterialRow(e))}async getMaterialsPaginated(e){let t=e.page||1,a=e.pageSize||50,r=[],s=[],E=1;e.status&&"all"!==e.status&&("processed"===e.status?r.push("m.status = 'processed'"):"published"===e.status?r.push("m.status = 'published'"):"new"===e.status?r.push("m.status = 'new'"):(r.push(`m.status = $${E}`),s.push(e.status),E++)),e.search&&e.search.trim()&&(r.push(`(m.title ILIKE $${E} OR m.content ILIKE $${E} OR m.full_content ILIKE $${E})`),s.push(`%${e.search.trim()}%`),E++),e.categoryIds&&e.categoryIds.length>0&&(r.push(`EXISTS (
        SELECT 1 FROM material_categories mc 
        WHERE mc.material_id = m.id 
        AND mc.category_id = ANY($${E}::int[])
      )`),s.push(e.categoryIds),E++),e.countryIds&&e.countryIds.length>0&&(r.push(`EXISTS (
        SELECT 1 FROM material_countries mc 
        WHERE mc.material_id = m.id 
        AND mc.country_id = ANY($${E}::int[])
      )`),s.push(e.countryIds),E++),e.cityIds&&e.cityIds.length>0&&(r.push(`EXISTS (
        SELECT 1 FROM material_cities mci 
        WHERE mci.material_id = m.id 
        AND mci.city_id = ANY($${E}::int[])
      )`),s.push(e.cityIds),E++),e.feedNames&&e.feedNames.length>0&&(r.push(`(f.title = ANY($${E}::text[]) OR m.source = ANY($${E}::text[]))`),s.push(e.feedNames),E++);let n=r.length>0?`WHERE ${r.join(" AND ")}`:"",c=parseInt((await i.query(`SELECT COUNT(*) as total FROM materials m LEFT JOIN feeds f ON m.source = f.url ${n}`,s)).rows[0].total);return{materials:(await i.query(`${this.materialSelect(n)} LIMIT $${E} OFFSET $${E+1}`,[...s,a,(t-1)*a])).rows.map(e=>this.transformMaterialRow(e)),total:c,page:t,pageSize:a,totalPages:Math.ceil(c/a)}}async getMaterialById(e){let t=await i.query(this.materialSelect("WHERE m.id = $1"),[e]);return t.rows[0]?this.transformMaterialRow(t.rows[0]):null}async getTaxonomy(){let[e,t,a]=await Promise.all([i.query('SELECT id, name, is_hidden AS "isHidden" FROM categories ORDER BY name ASC'),i.query("SELECT id, name FROM countries ORDER BY name ASC"),i.query('SELECT id, name, country_id AS "countryId" FROM cities ORDER BY name ASC')]),r=a.rows.reduce((e,t)=>(e[t.countryId]||(e[t.countryId]=[]),e[t.countryId].push(t),e),{}),s=t.rows.map(e=>({...e,cities:r[e.id]??[]}));return{categories:e.rows,countries:s}}async createTaxonomyItem(e,t,a){let r=t.trim();if(!r)throw Error("Название не может быть пустым");switch(e){case"category":return(await i.query('INSERT INTO categories (name) VALUES ($1) RETURNING id, name, is_hidden AS "isHidden"',[r])).rows[0];case"country":return(await i.query("INSERT INTO countries (name) VALUES ($1) RETURNING id, name",[r])).rows[0];case"city":{let e=a?.countryId;if(!e)throw Error("Необходимо указать страну для города");return(await i.query('INSERT INTO cities (name, country_id) VALUES ($1, $2) RETURNING id, name, country_id AS "countryId"',[r,e])).rows[0]}default:throw Error("Неизвестный тип таксономии")}}async updateTaxonomyItem(e,t,a){let r=a.name?.trim();switch(e){case"category":{let e=[],s=[],E=1;if(void 0!==r){if(!r)throw Error("Название категории не может быть пустым");e.push(`name = $${E}`),s.push(r),E++}if("boolean"==typeof a.isHidden&&(e.push(`is_hidden = $${E}`),s.push(a.isHidden),E++),0===e.length)throw Error("Нет данных для обновления категории");return(await i.query(`UPDATE categories SET ${e.join(", ")} WHERE id = $${E} RETURNING id, name, is_hidden AS "isHidden"`,[...s,t])).rows[0]}case"country":if(!r)throw Error("Название страны не может быть пустым");return(await i.query("UPDATE countries SET name = $1 WHERE id = $2 RETURNING id, name",[r,t])).rows[0];case"city":{if(!r)throw Error("Название города не может быть пустым");let e=void 0!==a.countryId&&null!==a.countryId?Number(a.countryId):null;if(!e)throw Error("Для города необходимо указать страну");return(await i.query('UPDATE cities SET name = $1, country_id = $2 WHERE id = $3 RETURNING id, name, country_id AS "countryId"',[r,e,t])).rows[0]}default:throw Error("Неизвестный тип таксономии")}}async deleteTaxonomyItem(e,t){let a=await i.connect();try{switch(await a.query("BEGIN"),e){case"category":await a.query("DELETE FROM categories WHERE id = $1",[t]);break;case"city":await a.query("UPDATE materials SET city_id = NULL WHERE city_id = $1",[t]),await a.query("DELETE FROM cities WHERE id = $1",[t]);break;case"country":await a.query("UPDATE materials SET city_id = NULL WHERE city_id IN (SELECT id FROM cities WHERE country_id = $1)",[t]),await a.query("UPDATE materials SET country_id = NULL WHERE country_id = $1",[t]),await a.query("DELETE FROM countries WHERE id = $1",[t]);break;default:throw Error("Неизвестный тип таксономии")}await a.query("COMMIT")}catch(e){throw await a.query("ROLLBACK"),e}finally{a.release()}}async updateMaterialTaxonomy(e,t){let a=await i.connect();try{if(await a.query("BEGIN"),await a.query("DELETE FROM material_categories WHERE material_id = $1",[e]),await a.query("DELETE FROM material_countries WHERE material_id = $1",[e]),await a.query("DELETE FROM material_cities WHERE material_id = $1",[e]),t.categoryIds&&t.categoryIds.length>0)for(let i of t.categoryIds)await a.query("INSERT INTO material_categories (material_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[e,i]);if(t.countryIds&&t.countryIds.length>0)for(let i of t.countryIds)await a.query("INSERT INTO material_countries (material_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[e,i]);if(t.cityIds&&t.cityIds.length>0)for(let i of t.cityIds)await a.query("INSERT INTO material_cities (material_id, city_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[e,i]);await a.query("COMMIT")}catch(e){throw await a.query("ROLLBACK"),e}finally{a.release()}}async deleteMaterial(e){let t=await i.connect();try{await t.query("BEGIN"),await t.query("DELETE FROM material_categories WHERE material_id = $1",[e]),await t.query("DELETE FROM material_countries WHERE material_id = $1",[e]),await t.query("DELETE FROM material_cities WHERE material_id = $1",[e]),await t.query("DELETE FROM categorization_logs WHERE material_id = $1",[e]),await t.query("DELETE FROM materials WHERE id = $1",[e]),await t.query("COMMIT")}catch(e){throw await t.query("ROLLBACK"),e}finally{t.release()}}async getCitiesByCountry(e){return(await i.query('SELECT id, name, country_id AS "countryId" FROM cities WHERE country_id = $1 ORDER BY name ASC',[e])).rows}async updateMaterialAttributes(e,t){let a=[],r=[],s=1;void 0!==t.status&&(a.push(`status = $${s}`),r.push(t.status),s++),void 0!==t.processed&&(a.push(`processed = $${s}`),r.push(t.processed),s++),void 0!==t.published&&(a.push(`published = $${s}`),r.push(t.published),s++),0!==a.length&&(r.push(e),await i.query(`UPDATE materials SET ${a.join(", ")}, updated_at = NOW() WHERE id = $${s}`,r))}async getStats(){return(await i.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'processed') as processed_count,
        COUNT(*) FILTER (WHERE status = 'published') as published_count,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
        MAX(fetched_at) as last_fetch
      FROM materials
    `)).rows[0]}async close(){await i.end()}async addFeed(e,t,a){return(await i.query(`INSERT INTO feeds (url, title, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (url) DO UPDATE SET
         title = COALESCE(EXCLUDED.title, feeds.title),
         description = COALESCE(EXCLUDED.description, feeds.description)
       RETURNING *`,[e,t,a])).rows[0]}async getAllFeeds(){return(await i.query(`SELECT id, url, title, description, last_fetched as "lastFetched", status, created_at as "createdAt"
       FROM feeds
       WHERE status = 'active'
       ORDER BY created_at DESC`)).rows}async getFeedById(e){return(await i.query(`SELECT id, url, title, description, last_fetched as "lastFetched", status, created_at as "createdAt"
       FROM feeds
       WHERE id = $1`,[e])).rows[0]}async updateFeedFetchTime(e){await i.query("UPDATE feeds SET last_fetched = NOW() WHERE id = $1",[e])}async updateFeedTitle(e,t){await i.query("UPDATE feeds SET title = $1 WHERE id = $2",[t,e])}async deleteFeed(e){await i.query("UPDATE feeds SET status = $1 WHERE id = $2",["deleted",e])}async getSetting(e){let t=await i.query("SELECT value FROM settings WHERE key = $1",[e]);return t.rows[0]?.value||null}async setSetting(e,t){await i.query(`INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = NOW()`,[e,t])}async getSettings(){let e=await i.query("SELECT key, value FROM settings"),t={};return e.rows.forEach(e=>{t[e.key]=e.value}),t}async updateMaterialSummary(e,t){let a=[],r=[],s=1;void 0!==t.summary&&(a.push(`summary = $${s}`),r.push(t.summary),s++),void 0!==t.metaDescription&&(a.push(`meta_description = $${s}`),r.push(t.metaDescription),s++),void 0!==t.sentiment&&(a.push(`sentiment = $${s}`),r.push(t.sentiment),s++),void 0!==t.contentType&&(a.push(`content_type = $${s}`),r.push(t.contentType),s++),!0===t.setProcessed&&(a.push("processed = TRUE"),a.push(`status = CASE
        WHEN status = 'archived' THEN status
        WHEN status = 'published' THEN status
        ELSE 'processed'
      END`)),a.length>0&&(r.push(e),await i.query(`UPDATE materials SET ${a.join(", ")} WHERE id = $${s}`,r))}async getCategoryExamples(e=15){return(await i.query(`
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
      `,[e])).rows}async createCategorizationLog(e){await i.query(`
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
      `,[e.materialId,e.supercategory??null,e.predictedCategory??null,e.validationCategory??null,e.confidence??null,e.validationConfidence??null,e.reasoning?JSON.stringify(e.reasoning):null,e.metadata?JSON.stringify(e.metadata):null])}async getCategorizationLogs(e=100){return(await i.query(`
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
      `,[e])).rows.map(e=>{let t=null,a=null;try{t=e.reasoning?JSON.parse(e.reasoning):null}catch(e){console.warn("Failed to parse categorization log reasoning:",e)}try{a=e.metadata?JSON.parse(e.metadata):null}catch(e){console.warn("Failed to parse categorization log metadata:",e)}return{id:e.id,materialId:e.materialId,title:e.title,supercategory:e.supercategory,predictedCategory:e.predictedCategory,validationCategory:e.validationCategory,confidence:null!==e.confidence?Number(e.confidence):null,validationConfidence:null!==e.validationConfidence?Number(e.validationConfidence):null,reasoning:t,metadata:a,createdAt:e.createdAt}})}async logSystemEvent(e){let t=e.level&&e.level.trim().length>0?e.level:"error";await i.query(`
      INSERT INTO system_logs (
        level,
        source,
        message,
        details,
        stack
      ) VALUES ($1, $2, $3, $4, $5)
      `,[t,e.source??null,e.message,e.details?JSON.stringify(e.details):null,e.stack??null])}async getSystemLogs(e=200){return(await i.query(`
      SELECT 
        id,
        level,
        source,
        message,
        details,
        stack,
        created_at AS "createdAt"
      FROM system_logs
      ORDER BY created_at DESC
      LIMIT $1
      `,[e])).rows.map(e=>{let t=null;if(e.details){if("string"==typeof e.details)try{t=JSON.parse(e.details)}catch(a){console.warn("Failed to parse system log details:",a),t={raw:e.details}}else t=e.details}return{id:e.id,level:e.level,source:e.source,message:e.message,details:t,stack:e.stack??null,createdAt:e.createdAt}})}}let s=new r},7435:(e,t,a)=>{a.d(t,{r:()=>s});var i=a(9487);async function r(e){let t={level:e.level??"info",source:e.source,message:e.message,details:e.details,stack:e.stack};try{await i.db.logSystemEvent(t)}catch(e){if(console.error("Failed to write system log:",e),e?.code==="42P01")try{await i.db.init(),await i.db.logSystemEvent(t);return}catch(e){console.error("Failed to initialize logging tables:",e)}}}async function s(e,t,a){let i;let s=a?{...a}:{},E="Unknown error";if(t instanceof Error)E=t.message,i=t.stack||void 0,s.errorName=t.name;else if("string"==typeof t)E=t;else if(t)try{E=JSON.stringify(t)}catch{E=String(t)}await r({level:"error",source:e,message:E,details:Object.keys(s).length>0?s:void 0,stack:i})}}};