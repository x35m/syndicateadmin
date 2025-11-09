import { Material } from './types'

const API_BASE_URL = process.env.API_BASE_URL || 'https://organic-kangaroo.pikapod.net'
const API_KEY = process.env.API_KEY || ''

export interface SyncStats {
  totalFeeds: number
  totalFetched: number
  newMaterials: number
  updatedMaterials: number
  skippedMaterials: number
  feedDetails: Array<{
    feedName: string
    feedId: string
    fetched: number
  }>
}

export class ApiService {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = API_BASE_URL
    this.apiKey = API_KEY
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    // Объединяем headers из options с дефолтными
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    const headers = {
      ...defaultHeaders,
      ...(options.headers || {}),
    }

    // CommaFeed использует API ключ в query параметре
    // Добавляем его к URL
    const separator = url.includes('?') ? '&' : '?'
    const urlWithAuth = this.apiKey ? `${url}${separator}apiKey=${this.apiKey}` : url

    const response = await fetch(urlWithAuth, {
      ...options,
      headers,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Получить список всех фидов из корневой категории
  async getSubscriptions(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/rest/category/get`
      const data = await this.fetchWithAuth(url)
      
      // Рекурсивно извлекаем все подписки из категорий
      const subscriptions: any[] = []
      
      const extractFeeds = (category: any) => {
        if (category.feeds && Array.isArray(category.feeds)) {
          subscriptions.push(...category.feeds)
        }
        if (category.children && Array.isArray(category.children)) {
          category.children.forEach((child: any) => extractFeeds(child))
        }
      }
      
      extractFeeds(data)
      console.log(`[${new Date().toISOString()}] Found ${subscriptions.length} feed subscriptions`)
      
      return subscriptions
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
      return []
    }
  }

  // Подписаться на новый фид (с несколькими способами попыток)
  async subscribeFeed(feedUrl: string, categoryId: string = 'all'): Promise<{ success: boolean; feedId?: string; error?: string }> {
    console.log(`[${new Date().toISOString()}] Subscribing to feed: ${feedUrl}`)
    
    const baseUrl = `${this.baseUrl}/rest/feed/subscribe`
    const requestBody = {
      url: feedUrl,
      categoryId: categoryId,
      title: '',
    }
    
    // Способ 1: API ключ в query параметре + JSON body
    try {
      console.log('Attempt 1: API key in query + JSON body')
      const url = `${baseUrl}?apiKey=${this.apiKey}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        console.log(`[${new Date().toISOString()}] Successfully subscribed (method 1)`, data)
        return { success: true, feedId: data.id || data.feedId }
      }
      console.log(`Attempt 1 failed: ${response.status} ${response.statusText}`)
    } catch (error) {
      console.log('Attempt 1 error:', error)
    }
    
    // Способ 2: API ключ в query параметре + form data
    try {
      console.log('Attempt 2: API key in query + form data')
      const url = `${baseUrl}?apiKey=${this.apiKey}`
      const formData = new URLSearchParams({
        url: feedUrl,
        categoryId: categoryId,
      })
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      })
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        console.log(`[${new Date().toISOString()}] Successfully subscribed (method 2)`, data)
        return { success: true, feedId: data.id || data.feedId }
      }
      console.log(`Attempt 2 failed: ${response.status} ${response.statusText}`)
    } catch (error) {
      console.log('Attempt 2 error:', error)
    }
    
    // Способ 3: Параметры в URL
    try {
      console.log('Attempt 3: All params in URL')
      const params = new URLSearchParams({
        url: feedUrl,
        categoryId: categoryId,
        apiKey: this.apiKey,
      })
      const url = `${baseUrl}?${params.toString()}`
      const response = await fetch(url, {
        method: 'POST',
      })
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        console.log(`[${new Date().toISOString()}] Successfully subscribed (method 3)`, data)
        return { success: true, feedId: data.id || data.feedId }
      }
      console.log(`Attempt 3 failed: ${response.status} ${response.statusText}`)
    } catch (error) {
      console.log('Attempt 3 error:', error)
    }
    
    // Все способы не сработали
    return {
      success: false,
      error: 'Не удалось добавить фид. CommaFeed API не принимает запросы. Пожалуйста, добавьте фид вручную через веб-интерфейс CommaFeed, затем используйте кнопку импорта в админке.',
    }
  }

  // Отписаться от фида (с несколькими способами попыток)
  async unsubscribeFeed(feedId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[${new Date().toISOString()}] Unsubscribing from feed: ${feedId}`)
    
    const baseUrl = `${this.baseUrl}/rest/feed/unsubscribe`
    
    // Способ 1: API ключ в query + JSON body
    try {
      const url = `${baseUrl}?apiKey=${this.apiKey}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: feedId }),
      })
      
      if (response.ok) {
        console.log(`[${new Date().toISOString()}] Successfully unsubscribed (method 1)`)
        return { success: true }
      }
    } catch (error) {
      console.log('Unsubscribe attempt 1 error:', error)
    }
    
    // Способ 2: Параметры в URL
    try {
      const url = `${baseUrl}?id=${feedId}&apiKey=${this.apiKey}`
      const response = await fetch(url, {
        method: 'POST',
      })
      
      if (response.ok) {
        console.log(`[${new Date().toISOString()}] Successfully unsubscribed (method 2)`)
        return { success: true }
      }
    } catch (error) {
      console.log('Unsubscribe attempt 2 error:', error)
    }
    
    return {
      success: false,
      error: 'Не удалось удалить фид через API',
    }
  }

  // Загрузить статьи из конкретного фида
  async fetchFromFeed(feedId: string, limit: number = 30): Promise<Material[]> {
    try {
      const url = `${this.baseUrl}/rest/feed/entries?id=${feedId}&readType=all&offset=0&limit=${limit}&order=desc`
      const data = await this.fetchWithAuth(url)
      
      return this.transformApiResponse(data)
    } catch (error) {
      console.error(`Error fetching from feed ${feedId}:`, error)
      return []
    }
  }

  // Умная синхронизация: загружаем из каждого фида отдельно
  async fetchNewMaterials(): Promise<Material[]> {
    try {
      console.log(`[${new Date().toISOString()}] Starting intelligent sync...`)
      
      // Получаем список всех фидов
      const subscriptions = await this.getSubscriptions()
      
      if (subscriptions.length === 0) {
        console.warn('No subscriptions found in CommaFeed')
        return []
      }
      
      const allMaterials: Material[] = []
      const feedDetails: Array<{ feedName: string; feedId: string; fetched: number }> = []
      
      // Загружаем статьи из каждого фида
      for (const feed of subscriptions) {
        const feedId = feed.id
        const feedName = feed.name || feed.feedName || 'Unknown Feed'
        
        console.log(`[${new Date().toISOString()}] Syncing feed: ${feedName} (ID: ${feedId})`)
        
        const materials = await this.fetchFromFeed(feedId, 30) // Берем последние 30 статей из каждого фида
        
        allMaterials.push(...materials)
        feedDetails.push({
          feedName,
          feedId,
          fetched: materials.length,
        })
        
        console.log(`[${new Date().toISOString()}] Fetched ${materials.length} entries from ${feedName}`)
      }
      
      console.log(`[${new Date().toISOString()}] Total fetched: ${allMaterials.length} entries from ${subscriptions.length} feeds`)
      console.log('[SYNC STATS]', JSON.stringify({
        totalFeeds: subscriptions.length,
        totalFetched: allMaterials.length,
        feedDetails,
      }, null, 2))
      
      return allMaterials
    } catch (error) {
      console.error('Error fetching materials:', error)
      throw error
    }
  }

  private transformApiResponse(data: any): Material[] {
    // CommaFeed возвращает объект с полем entries
    const entries = data.entries || []
    
    if (!Array.isArray(entries)) {
      console.warn('Unexpected data format from CommaFeed API')
      return []
    }

    return entries.map((entry: any) => {
      // CommaFeed может возвращать контент в разных полях
      let htmlContent = entry.content?.content || entry.content || ''
      
      // Извлекаем текстовый контент из HTML (для preview)
      const content = this.stripHtml(htmlContent)
      
      // Извлекаем изображение из разных возможных мест
      let thumbnail = this.extractFirstImage(htmlContent)
      
      // Если нет изображения в content, проверяем enclosureUrl или другие поля
      if (!thumbnail && entry.enclosureUrl) {
        thumbnail = entry.enclosureUrl
      }
      if (!thumbnail && entry.mediaContent && entry.mediaContent.length > 0) {
        thumbnail = entry.mediaContent[0].url
      }
      
      // Если есть enclosureUrl и его нет в HTML - добавляем в начало контента
      if (entry.enclosureUrl && !htmlContent.includes(entry.enclosureUrl)) {
        const imgTag = `<img src="${entry.enclosureUrl}" alt="${entry.title || ''}" style="max-width: 100%; height: auto;" />`
        htmlContent = imgTag + htmlContent
      }
      
      // Собираем все изображения из mediaContent если есть
      if (entry.mediaContent && Array.isArray(entry.mediaContent)) {
        entry.mediaContent.forEach((media: any) => {
          if (media.url && !htmlContent.includes(media.url)) {
            const imgTag = `<img src="${media.url}" alt="${media.description || ''}" style="max-width: 100%; height: auto;" />`
            htmlContent = htmlContent + imgTag
          }
        })
      }
      
      return {
        id: String(entry.id || Math.random()),
        title: entry.title || 'Untitled',
        content: content.substring(0, 500), // Ограничиваем длину для preview
        fullContent: htmlContent, // Сохраняем полный HTML с добавленными изображениями
        thumbnail: thumbnail, // URL первого изображения
        author: entry.author || entry.feedName || undefined,
        createdAt: entry.date ? new Date(entry.date).toISOString() : new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        source: entry.feedName || entry.feedUrl || this.baseUrl,
        status: 'new' as const,
      }
    })
  }

  // Извлекаем URL первого изображения из HTML
  private extractFirstImage(html: string): string | undefined {
    // Ищем первый тег <img> и извлекаем src
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/i
    const match = html.match(imgRegex)
    return match ? match[1] : undefined
  }

  // Вспомогательная функция для удаления HTML тегов
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ') // Удаляем HTML теги
      .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
      .trim()
  }
}

export const apiService = new ApiService()
