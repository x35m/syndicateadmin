export interface Material {
  id: string
  title: string
  content: string
  fullContent?: string // Полный HTML контент с форматированием
  thumbnail?: string // URL первого изображения (обложка)
  author?: string
  createdAt: string
  fetchedAt: string
  source: string
  feedName?: string // Название фида-источника
  status: 'new' | 'processed' | 'archived'
}

export interface ApiConfig {
  baseUrl: string
  apiKey?: string
  endpoints: {
    materials: string
  }
}
