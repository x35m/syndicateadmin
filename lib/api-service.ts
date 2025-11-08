import { Material } from './types'

const API_BASE_URL = process.env.API_BASE_URL || 'https://organic-kangaroo.pikapod.net'
const API_KEY = process.env.API_KEY || ''

export class ApiService {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = API_BASE_URL
    this.apiKey = API_KEY
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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

  async fetchNewMaterials(): Promise<Material[]> {
    try {
      // CommaFeed API: получаем все записи из всех категорий
      // id=all означает получить записи из всех подписок
      // readType=all - загружаем ВСЕ статьи (включая прочитанные)
      const url = `${this.baseUrl}/rest/category/entries?id=all&readType=all&offset=0&limit=100&order=desc`
      
      const data = await this.fetchWithAuth(url)

      console.log(`[${new Date().toISOString()}] Fetched ${data.entries?.length || 0} entries from CommaFeed`)

      // Адаптируем данные CommaFeed к нашему формату
      return this.transformApiResponse(data)
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
      const htmlContent = entry.content || ''
      
      // Извлекаем текстовый контент из HTML (для preview)
      const content = this.stripHtml(htmlContent)
      
      // Извлекаем первое изображение для обложки
      const thumbnail = this.extractFirstImage(htmlContent)
      
      return {
        id: String(entry.id || Math.random()),
        title: entry.title || 'Untitled',
        content: content.substring(0, 500), // Ограничиваем длину для preview
        fullContent: htmlContent, // Сохраняем полный HTML
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
