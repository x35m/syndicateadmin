import { Material } from './types'

interface RSSItem {
  title: string
  link: string
  description: string
  content?: string
  pubDate: string
  author?: string
  guid?: string
  enclosure?: {
    url: string
    type: string
  }
}

interface RSSFeed {
  title: string
  description: string
  items: RSSItem[]
}

export class RSSParser {
  // Парсим RSS/Atom фид
  async parseFeed(url: string): Promise<RSSFeed> {
    console.log(`[RSS Parser] Fetching feed: ${url}`)
    
    // Пытаемся загрузить напрямую
    try {
      return await this.fetchDirect(url)
    } catch (directError) {
      console.warn(`[RSS Parser] Direct fetch failed:`, directError)
      
      // Если получили 403 Forbidden, пробуем через прокси
      if (directError instanceof Error && directError.message.includes('403')) {
        console.log(`[RSS Parser] Trying via RSS proxy...`)
        return await this.fetchViaProxy(url)
      }
      
      throw directError
    }
  }

  // Прямая загрузка фида
  private async fetchDirect(url: string): Promise<RSSFeed> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
        'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8,ru;q=0.7',
        'Cache-Control': 'no-cache',
        'Referer': new URL(url).origin,
      },
    })

    if (!response.ok) {
      console.error(`[RSS Parser] HTTP ${response.status}: ${response.statusText}`)
      throw new Error(`Не вдалося завантажити фід: HTTP ${response.status} - ${response.statusText}`)
    }

    const xmlText = await response.text()
    
    if (!xmlText || xmlText.trim().length === 0) {
      throw new Error('Фід порожній або не містить даних')
    }
    
    console.log(`[RSS Parser] Received ${xmlText.length} bytes of XML`)
    
    return this.parseXML(xmlText)
  }

  // Загрузка через RSS прокси (для обхода 403 ошибок)
  private async fetchViaProxy(url: string): Promise<RSSFeed> {
    const proxies = [
      // Прокси 1: RSS2JSON (конвертирует RSS в JSON, потом парсим)
      {
        name: 'RSS2JSON',
        url: `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
        type: 'json' as const,
      },
      // Прокси 2: AllOrigins
      {
        name: 'AllOrigins',
        url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        type: 'xml' as const,
      },
      // Прокси 3: CORS Anywhere (резервный)
      {
        name: 'ThingProxy',
        url: `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
        type: 'xml' as const,
      },
    ]

    let lastError: Error | null = null

    // Пробуем каждый прокси по очереди
    for (const proxy of proxies) {
      try {
        console.log(`[RSS Parser] Trying ${proxy.name} proxy: ${proxy.url}`)
        
        const response = await fetch(proxy.url, {
          headers: {
            'Accept': 'application/json, application/xml, text/xml, */*',
          },
        })

        if (!response.ok) {
          console.warn(`[RSS Parser] ${proxy.name} returned HTTP ${response.status}`)
          lastError = new Error(`${proxy.name}: HTTP ${response.status}`)
          continue
        }

        if (proxy.type === 'json') {
          // RSS2JSON возвращает JSON
          const jsonData = await response.json()
          
          if (jsonData.status !== 'ok') {
            console.warn(`[RSS Parser] RSS2JSON error:`, jsonData.message)
            lastError = new Error(`RSS2JSON: ${jsonData.message || 'Unknown error'}`)
            continue
          }
          
          console.log(`[RSS Parser] ✅ ${proxy.name} success! Converting JSON to RSS format...`)
          return this.convertRSS2JSONToFeed(jsonData)
        } else {
          // XML прокси
          const xmlText = await response.text()
          
          if (!xmlText || xmlText.trim().length === 0) {
            console.warn(`[RSS Parser] ${proxy.name} returned empty response`)
            lastError = new Error(`${proxy.name}: Empty response`)
            continue
          }
          
          console.log(`[RSS Parser] ✅ ${proxy.name} success! Received ${xmlText.length} bytes`)
          return this.parseXML(xmlText)
        }
      } catch (error) {
        console.warn(`[RSS Parser] ${proxy.name} failed:`, error)
        lastError = error instanceof Error ? error : new Error(String(error))
        continue
      }
    }

    // Все прокси не сработали
    console.error('[RSS Parser] All proxies failed')
    throw new Error(
      `Не вдалося завантажити фід навіть через проксі.\n\n` +
      `Остання помилка: ${lastError?.message || 'Unknown'}\n\n` +
      `Можливі причини:\n` +
      `• Сайт блокує всі автоматичні запити\n` +
      `• Потрібна авторизація або Cookie\n` +
      `• Сайт недоступний\n\n` +
      `Спробуйте інший RSS фід або зверніться до адміністратора сайту.`
    )
  }

  // Конвертируем JSON от RSS2JSON в наш формат
  private convertRSS2JSONToFeed(jsonData: any): RSSFeed {
    const feed: RSSFeed = {
      title: jsonData.feed?.title || 'RSS Feed',
      description: jsonData.feed?.description || '',
      items: [],
    }

    if (!jsonData.items || !Array.isArray(jsonData.items)) {
      return feed
    }

    feed.items = jsonData.items.map((item: any) => ({
      title: item.title || 'Без назви',
      link: item.link || item.guid || '',
      description: item.description || '',
      content: item.content || item.description || '',
      pubDate: item.pubDate || new Date().toISOString(),
      author: item.author || jsonData.feed?.title || '',
      guid: item.guid || item.link || '',
      enclosure: item.enclosure?.link ? {
        url: item.enclosure.link,
        type: item.enclosure.type || 'image/jpeg',
      } : (item.thumbnail ? {
        url: item.thumbnail,
        type: 'image/jpeg',
      } : undefined),
    }))

    console.log(`[RSS Parser] Converted ${feed.items.length} items from RSS2JSON`)
    return feed
  }

  // Парсим XML в структуру RSS
  private parseXML(xmlText: string): RSSFeed {
    const feed: RSSFeed = {
      title: '',
      description: '',
      items: [],
    }

    // Простой парсинг XML (без библиотек)
    // Определяем тип фида: RSS или Atom
    const isAtom = xmlText.includes('<feed') && xmlText.includes('xmlns="http://www.w3.org/2005/Atom"')
    
    console.log(`[RSS Parser] Detected feed type: ${isAtom ? 'Atom' : 'RSS'}`)
    console.log(`[RSS Parser] XML sample: ${xmlText.substring(0, 500)}...`)

    if (isAtom) {
      return this.parseAtom(xmlText)
    } else {
      return this.parseRSS(xmlText)
    }
  }

  private parseRSS(xmlText: string): RSSFeed {
    const feed: RSSFeed = {
      title: this.extractTag(xmlText, 'title') || 'RSS Feed',
      description: this.extractTag(xmlText, 'description') || '',
      items: [],
    }

    // Извлекаем все <item>...</item> используя exec в цикле
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
    let match
    
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXML = match[1]
      
      const item: RSSItem = {
        title: this.extractTag(itemXML, 'title') || 'Без названия',
        link: this.extractTag(itemXML, 'link') || '',
        description: this.extractTag(itemXML, 'description') || '',
        content: this.extractTag(itemXML, 'content:encoded') || this.extractTag(itemXML, 'content') || '',
        pubDate: this.extractTag(itemXML, 'pubDate') || this.extractTag(itemXML, 'dc:date') || new Date().toISOString(),
        author: this.extractTag(itemXML, 'author') || this.extractTag(itemXML, 'dc:creator') || '',
        guid: this.extractTag(itemXML, 'guid') || '',
      }

      // Извлекаем enclosure (изображение)
      const enclosureMatch = itemXML.match(/<enclosure[^>]*url=["']([^"']*)["'][^>]*type=["']([^"']*)["'][^>]*\/?>/)
      if (enclosureMatch) {
        item.enclosure = {
          url: enclosureMatch[1],
          type: enclosureMatch[2],
        }
      }

      feed.items.push(item)
    }

    console.log(`[RSS Parser] Parsed ${feed.items.length} items from RSS feed`)
    
    if (feed.items.length === 0) {
      console.warn('[RSS Parser] WARNING: No items found in RSS feed')
      console.warn('[RSS Parser] Feed title:', feed.title)
      console.warn('[RSS Parser] Feed description:', feed.description)
    }
    
    return feed
  }

  private parseAtom(xmlText: string): RSSFeed {
    const feed: RSSFeed = {
      title: this.extractTag(xmlText, 'title') || 'Atom Feed',
      description: this.extractTag(xmlText, 'subtitle') || '',
      items: [],
    }

    // Извлекаем все <entry>...</entry> используя exec в цикле
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi
    let match
    
    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entryXML = match[1]
      
      // Извлекаем link
      const linkMatch = entryXML.match(/<link[^>]*href=["']([^"']*)["']/)
      
      const item: RSSItem = {
        title: this.extractTag(entryXML, 'title') || 'Без названия',
        link: linkMatch ? linkMatch[1] : '',
        description: this.extractTag(entryXML, 'summary') || '',
        content: this.extractTag(entryXML, 'content') || '',
        pubDate: this.extractTag(entryXML, 'published') || this.extractTag(entryXML, 'updated') || new Date().toISOString(),
        author: this.extractTag(entryXML, 'author') || '',
        guid: this.extractTag(entryXML, 'id') || '',
      }

      feed.items.push(item)
    }

    console.log(`[RSS Parser] Parsed ${feed.items.length} items from Atom feed`)
    return feed
  }

  // Извлекаем содержимое тега
  private extractTag(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, 'i')
    const match = xml.match(regex)
    
    if (match && match[1]) {
      // Декодируем HTML entities и убираем CDATA
      return this.decodeHTML(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim())
    }
    
    return null
  }

  // Декодируем HTML entities
  private decodeHTML(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
  }

  // Преобразуем RSS items в наш формат Material
  convertToMaterials(feedTitle: string, feedUrl: string, items: RSSItem[]): Material[] {
    return items.map((item) => {
      const htmlContent = item.content || item.description || ''
      const textContent = this.stripHtml(htmlContent)
      
      // Извлекаем изображение
      let thumbnail = this.extractFirstImage(htmlContent)
      if (!thumbnail && item.enclosure && item.enclosure.type.startsWith('image/')) {
        thumbnail = item.enclosure.url
      }
      
      // Добавляем изображение в HTML если его там нет
      let fullContent = htmlContent
      if (thumbnail && !fullContent.includes(thumbnail)) {
        fullContent = `<img src="${thumbnail}" alt="${item.title}" style="max-width: 100%; height: auto;" />` + fullContent
      }
      
      return {
        id: item.guid || item.link || `${feedUrl}-${Date.now()}-${Math.random()}`,
        title: item.title,
        content: textContent.substring(0, 500),
        fullContent: fullContent,
        thumbnail: thumbnail,
        author: item.author || feedTitle,
        createdAt: this.parseDate(item.pubDate),
        fetchedAt: new Date().toISOString(),
        source: feedTitle || feedUrl,
        status: 'new' as const,
      }
    })
  }

  private extractFirstImage(html: string): string | undefined {
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/i
    const match = html.match(imgRegex)
    return match ? match[1] : undefined
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private parseDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return new Date().toISOString()
      }
      return date.toISOString()
    } catch {
      return new Date().toISOString()
    }
  }
}

export const rssParser = new RSSParser()

