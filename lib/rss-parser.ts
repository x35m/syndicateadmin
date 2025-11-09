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
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MaterialAdmin/1.0)',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`)
      }

      const xmlText = await response.text()
      return this.parseXML(xmlText)
    } catch (error) {
      console.error('[RSS Parser] Error:', error)
      throw error
    }
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

