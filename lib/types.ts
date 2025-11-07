export interface Material {
  id: string
  title: string
  content: string
  author?: string
  createdAt: string
  fetchedAt: string
  source: string
  status: 'new' | 'processed' | 'archived'
}

export interface ApiConfig {
  baseUrl: string
  apiKey?: string
  endpoints: {
    materials: string
  }
}
