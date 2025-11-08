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

    // Если есть API ключ, добавляем его в заголовки
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
      // Или другой формат, если требуется:
      // headers['X-API-Key'] = this.apiKey
    }

    const response = await fetch(url, {
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
      // ВАЖНО: Замените этот эндпоинт на реальный из документации API
      // Примеры возможных эндпоинтов:
      // - /api/materials
      // - /api/posts
      // - /api/content/recent
      const url = `${this.baseUrl}/api/materials`
      
      const data = await this.fetchWithAuth(url)

      // Адаптируем данные к нашему формату
      // ВАЖНО: Измените это в соответствии с реальной структурой ответа API
      return this.transformApiResponse(data)
    } catch (error) {
      console.error('Error fetching materials:', error)
      throw error
    }
  }

  private transformApiResponse(data: any): Material[] {
    // ВАЖНО: Адаптируйте эту функцию под реальную структуру данных из API
    // Это пример трансформации, который нужно изменить
    
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        id: item.id || item._id || String(Math.random()),
        title: item.title || item.name || 'Untitled',
        content: item.content || item.body || item.text || '',
        author: item.author || item.user?.name || undefined,
        createdAt: item.created_at || item.createdAt || new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        source: this.baseUrl,
        status: 'new' as const,
      }))
    }

    // Если данные обернуты в объект с полем data или results
    if (data.data) {
      return this.transformApiResponse(data.data)
    }

    if (data.results) {
      return this.transformApiResponse(data.results)
    }

    return []
  }
}

export const apiService = new ApiService()
