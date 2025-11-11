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
  link?: string // Ссылка на оригинальную статью
  summary?: string // AI-генерированное саммари статьи
  metaDescription?: string // SEO мета-описание (150-160 символов)
  sentiment?: 'positive' | 'neutral' | 'negative' // Тональность материала
  contentType?: 'purely_factual' | 'mostly_factual' | 'balanced' | 'mostly_opinion' | 'purely_opinion' // Тип контента
  categories?: Category[]
  themes?: Theme[]
  tags?: Tag[]
  alliances?: Alliance[]
  countries?: Country[]
  cities?: City[]
}

export interface ApiConfig {
  baseUrl: string
  apiKey?: string
  endpoints: {
    materials: string
  }
}

export interface Category {
  id: number
  name: string
}

export interface Theme {
  id: number
  name: string
}

export interface Tag {
  id: number
  name: string
}

export interface Alliance {
  id: number
  name: string
}

export interface Country {
  id: number
  name: string
}

export interface City {
  id: number
  name: string
  countryId: number
}
