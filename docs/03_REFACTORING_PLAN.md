# План рефакторинга Syndicate Admin

**Дата:** 10 ноября 2025  
**Версия:** 1.0  
**Цель:** Устранить архитектурные проблемы без потери функциональности

---

## Общая стратегия

### Принципы рефакторинга
1. **Постепенность:** Малые шаги с тестированием после каждого
2. **Обратная совместимость:** Старый код продолжает работать
3. **Приоритет на критичное:** Сначала P0, потом P1, P2
4. **Документирование:** Каждое изменение документируется

### Оценка времени
- **Минимум:** 3-4 дня (только P0)
- **Оптимально:** 5-7 дней (P0 + P1)
- **Полный рефакторинг:** 10-14 дней (P0 + P1 + P2)

---

## Фаза 0: Подготовка (Day 0, 2-3 часа)

### 0.1. Создание тестового окружения

**Цель:** Безопасное тестирование изменений

**Задачи:**
```bash
# 1. Создать ветку для рефакторинга
git checkout -b refactor/architecture-improvements

# 2. Настроить локальную БД для тестирования
# Опционально: использовать Railway для staging окружения

# 3. Создать backup текущей БД
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

**Checklist:**
- [ ] Создана ветка refactor/architecture-improvements
- [ ] Локальная БД настроена
- [ ] Бэкап создан
- [ ] `.env.local` настроен с тестовыми переменными

---

### 0.2. Установка дополнительных зависимостей

```bash
# React Query для кеширования и управления состоянием
npm install @tanstack/react-query

# Zod для валидации
npm install zod

# Класс-валидатор для TypeScript
npm install class-validator class-transformer

# Axios для HTTP клиента (опционально, можно остаться на fetch)
npm install axios

# Dev dependencies
npm install -D @types/node
```

**Checklist:**
- [ ] Все зависимости установлены
- [ ] TypeScript конфигурация обновлена
- [ ] package-lock.json закоммичен

---

## Фаза 1: Создание архитектурных слоев (Day 1-2, 8-12 часов)

### 1.1. Создание структуры папок

**Цель:** Организовать код по принципу модульности

**Новая структура:**
```
/src
  /modules
    /feeds
      /api          - API routes для фидов
      /components   - UI компоненты
      /hooks        - Custom hooks (useFeeds, useFeedActions)
      /services     - Бизнес-логика (feedsService)
      /types        - TypeScript типы
      /schemas      - Zod schemas для валидации
    /materials
      /api
      /components
      /hooks
      /services
      /types
      /schemas
    /sync
      /api
      /services
  /shared
    /components    - Переиспользуемые UI компоненты
    /hooks         - Общие hooks
    /lib
      /api-client  - Централизованный HTTP клиент
      /db          - Database service
      /utils       - Утилиты
    /types         - Общие типы
    /constants     - Константы
```

**Шаги:**
1. Создать папки (не перемещая файлы)
2. Создать index.ts для каждого модуля
3. Настроить path aliases в tsconfig.json

**Checklist:**
- [ ] Папки созданы
- [ ] tsconfig.json обновлен с path aliases
- [ ] Компиляция проходит без ошибок

---

### 1.2. Создание типов и schemas (3-4 часа)

**Цель:** Централизованная типизация для всего проекта

#### Шаг 1.2.1: Создать общие типы API

**Файл:** `/src/shared/types/api.ts`
```typescript
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiError {
  success: false
  error: string
  code?: string
  details?: Record<string, unknown>
}
```

**Checklist:**
- [ ] Файл создан
- [ ] Типы экспортированы

---

#### Шаг 1.2.2: Создать типы для модуля Feeds

**Файл:** `/src/modules/feeds/types/index.ts`
```typescript
export interface Feed {
  id: string
  url: string
  title: string | null
  description: string | null
  lastFetched: string | null
  status: FeedStatus
  createdAt: string
}

export type FeedStatus = 'active' | 'error' | 'deleted'

export interface FeedStats {
  totalMaterials: number
  lastFetchStatus: 'success' | 'error' | 'pending'
}

export interface AddFeedRequest {
  feedUrl: string
}

export interface UpdateFeedRequest {
  id: string
  title?: string
  status?: FeedStatus
}

export interface ImportFeedRequest {
  feedId: string
}

export interface FeedImportResult {
  fetched: number
  new: number
  updated: number
  errors: number
}
```

**Checklist:**
- [ ] Типы созданы
- [ ] Экспортированы через index.ts

---

#### Шаг 1.2.3: Создать Zod schemas для валидации

**Файл:** `/src/modules/feeds/schemas/index.ts`
```typescript
import { z } from 'zod'

export const AddFeedSchema = z.object({
  feedUrl: z.string()
    .url('Некорректный URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'URL должен начинаться с http:// или https://'
    )
})

export const UpdateFeedSchema = z.object({
  id: z.string().uuid('Некорректный ID фида'),
  title: z.string().min(1, 'Название не может быть пустым').optional(),
  status: z.enum(['active', 'error', 'deleted']).optional(),
})

export const ImportFeedSchema = z.object({
  feedId: z.string().uuid('Некорректный ID фида'),
})

// Type inference
export type AddFeedInput = z.infer<typeof AddFeedSchema>
export type UpdateFeedInput = z.infer<typeof UpdateFeedSchema>
export type ImportFeedInput = z.infer<typeof ImportFeedSchema>
```

**Checklist:**
- [ ] Schemas созданы
- [ ] Типы выведены через z.infer
- [ ] Экспортированы

---

### 1.3. Создание Services слоя (4-5 часов)

**Цель:** Вынести бизнес-логику из компонентов

#### Шаг 1.3.1: Создать FeedsService

**Файл:** `/src/modules/feeds/services/feedsService.ts`
```typescript
import type { Feed, FeedImportResult, AddFeedInput, UpdateFeedInput } from '../types'
import type { ApiResponse } from '@/shared/types/api'

class FeedsService {
  private baseUrl = '/api/local-feeds'

  async getAll(): Promise<Feed[]> {
    const response = await fetch(this.baseUrl)
    const result: ApiResponse<Feed[]> = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch feeds')
    }
    
    return result.data || []
  }

  async add(input: AddFeedInput): Promise<FeedImportResult> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    
    const result: ApiResponse<{ stats: FeedImportResult }> = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to add feed')
    }
    
    return result.data!.stats
  }

  async update(input: UpdateFeedInput): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    
    const result: ApiResponse = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update feed')
    }
  }

  async import(feedId: string): Promise<FeedImportResult> {
    const response = await fetch(`${this.baseUrl}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedId }),
    })
    
    const result: ApiResponse<FeedImportResult> = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to import feed')
    }
    
    return result.data!
  }

  async delete(feedId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}?id=${feedId}`, {
      method: 'DELETE',
    })
    
    const result: ApiResponse = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete feed')
    }
  }
}

export const feedsService = new FeedsService()
```

**Checklist:**
- [ ] Service создан
- [ ] Все методы типизированы
- [ ] Ошибки обрабатываются
- [ ] Singleton экспортирован

---

#### Шаг 1.3.2: Создать MaterialsService

**Файл:** `/src/modules/materials/services/materialsService.ts`
```typescript
import type { Material } from '@/lib/types'
import type { ApiResponse } from '@/shared/types/api'

interface MaterialsStats {
  total: number
  new: number
  processed: number
  archived: number
}

interface GetMaterialsResponse {
  materials: Material[]
  stats: MaterialsStats
}

class MaterialsService {
  private baseUrl = '/api/materials'

  async getAll(status?: string): Promise<GetMaterialsResponse> {
    const url = status && status !== 'all' 
      ? `${this.baseUrl}?status=${status}`
      : this.baseUrl
      
    const response = await fetch(url)
    const result: ApiResponse<Material[]> & { stats: MaterialsStats } = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch materials')
    }
    
    return {
      materials: result.data || [],
      stats: result.stats,
    }
  }

  async updateStatus(id: string, status: Material['status']): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    
    const result: ApiResponse = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update material')
    }
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}?id=${id}`, {
      method: 'DELETE',
    })
    
    const result: ApiResponse = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete material')
    }
  }
}

export const materialsService = new MaterialsService()
```

**Checklist:**
- [ ] Service создан
- [ ] Методы типизированы
- [ ] Экспортирован

---

### 1.4. Создание Custom Hooks (3-4 часа)

**Цель:** Инкапсулировать логику работы с данными в переиспользуемые hooks

#### Шаг 1.4.1: Настроить React Query

**Файл:** `/src/shared/lib/query-client.ts`
```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 минут
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
```

**Файл:** `/src/app/layout.tsx` (обновить)
```typescript
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/shared/lib/query-client'

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

**Checklist:**
- [ ] QueryClient настроен
- [ ] Provider добавлен в layout
- [ ] Приложение компилируется

---

#### Шаг 1.4.2: Создать useFeeds hook

**Файл:** `/src/modules/feeds/hooks/useFeeds.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { feedsService } from '../services/feedsService'
import { toast } from 'sonner'
import type { AddFeedInput, UpdateFeedInput } from '../types'

const QUERY_KEY = ['feeds'] as const

export function useFeeds() {
  const queryClient = useQueryClient()

  // Запрос списка фидов
  const {
    data: feeds = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: feedsService.getAll,
  })

  // Добавление фида
  const addFeed = useMutation({
    mutationFn: (input: AddFeedInput) => feedsService.add(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success(
        `Фид успешно добавлен! Загружено: ${result.fetched}, Новых: ${result.new}`
      )
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  // Обновление фида
  const updateFeed = useMutation({
    mutationFn: (input: UpdateFeedInput) => feedsService.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Фид обновлен')
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  // Импорт фида
  const importFeed = useMutation({
    mutationFn: (feedId: string) => feedsService.import(feedId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success(
        `Импорт завершен! Загружено: ${result.fetched}, Новых: ${result.new}`
      )
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  // Удаление фида
  const deleteFeed = useMutation({
    mutationFn: (feedId: string) => feedsService.delete(feedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Фид удален')
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  return {
    feeds,
    isLoading,
    error,
    refetch,
    addFeed: addFeed.mutate,
    updateFeed: updateFeed.mutate,
    importFeed: importFeed.mutate,
    deleteFeed: deleteFeed.mutate,
    isAdding: addFeed.isPending,
    isUpdating: updateFeed.isPending,
    isImporting: importFeed.isPending,
    isDeleting: deleteFeed.isPending,
  }
}
```

**Checklist:**
- [ ] Hook создан
- [ ] Все операции обернуты в mutations
- [ ] Toast уведомления добавлены
- [ ] Типы корректны

---

#### Шаг 1.4.3: Создать useMaterials hook

**Файл:** `/src/modules/materials/hooks/useMaterials.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { materialsService } from '../services/materialsService'
import { toast } from 'sonner'
import type { Material } from '@/lib/types'

const QUERY_KEY = ['materials'] as const

export function useMaterials(status?: string) {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: [...QUERY_KEY, status],
    queryFn: () => materialsService.getAll(status),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Material['status'] }) =>
      materialsService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Статус обновлен')
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  const deleteMaterial = useMutation({
    mutationFn: (id: string) => materialsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Материал удален')
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  return {
    materials: data?.materials || [],
    stats: data?.stats,
    isLoading,
    error,
    updateStatus: updateStatus.mutate,
    deleteMaterial: deleteMaterial.mutate,
    isUpdating: updateStatus.isPending,
    isDeleting: deleteMaterial.isPending,
  }
}
```

**Checklist:**
- [ ] Hook создан
- [ ] Работает с разными статусами
- [ ] Экспортирован

---

## Фаза 2: Рефакторинг компонентов (Day 2-3, 6-8 часов)

### 2.1. Рефакторинг FeedManager

**Цель:** Упростить компонент, используя новый hook

**Файл:** `/src/modules/feeds/components/FeedManager.tsx`

**Было (проблемный код):**
```typescript
const [feeds, setFeeds] = useState<Feed[]>([])
const [loading, setLoading] = useState(true)

const fetchFeeds = async () => {
  setLoading(true)
  const response = await fetch('/api/local-feeds')
  const result = await response.json()
  setFeeds(result.data)
  setLoading(false)
}

useEffect(() => {
  fetchFeeds()
}, [])
```

**Стало (чистый код):**
```typescript
import { useFeeds } from '../hooks/useFeeds'

export function FeedManager() {
  const { 
    feeds, 
    isLoading, 
    addFeed, 
    updateFeed, 
    importFeed, 
    deleteFeed,
    isAdding,
    isImporting 
  } = useFeeds()

  // Компонент теперь только отображает UI!
  // Вся логика в hook
}
```

**Checklist:**
- [ ] useState удалены
- [ ] useEffect удалены
- [ ] Fetch логика удалена
- [ ] Используется useFeeds hook
- [ ] Компонент работает

---

### 2.2. Рефакторинг главной страницы

**Файл:** `/src/app/page.tsx`

**Упростить логику:**
```typescript
'use client'

import { useMaterials } from '@/modules/materials/hooks/useMaterials'
import { Header } from '@/components/header'
import { StatsCards } from '@/modules/materials/components/StatsCards'
import { FeedManager } from '@/modules/feeds/components/FeedManager'

export default function Home() {
  const { stats } = useMaterials()

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-8">
          {stats && <StatsCards stats={stats} />}
          <FeedManager />
        </div>
      </div>
    </>
  )
}
```

**Checklist:**
- [ ] Код упрощен
- [ ] Используются hooks
- [ ] Страница работает

---

## Фаза 3: Исправление Cron Job (Day 3, 3-4 часа)

### 3.1. Вынести Cron из layout.tsx

**Проблема:** Cron запускается в React component

**Решение:** Использовать Next.js API route для инициализации

#### Шаг 3.1.1: Создать отдельный файл для инициализации

**Файл:** `/src/lib/init.ts`
```typescript
import { initCronJob, runInitialFetch } from './cron'

let initialized = false

export async function initializeApp() {
  if (initialized) {
    console.log('App already initialized')
    return
  }

  console.log('Initializing app...')
  
  try {
    // Инициализация БД
    const { db } = await import('./db')
    await db.init()
    console.log('✅ Database initialized')

    // Первичная синхронизация
    await runInitialFetch()
    console.log('✅ Initial fetch completed')

    // Запуск cron job
    if (process.env.NODE_ENV === 'production') {
      initCronJob()
      console.log('✅ Cron job started')
    } else {
      console.log('⚠️ Cron job disabled in development')
    }

    initialized = true
  } catch (error) {
    console.error('❌ Failed to initialize app:', error)
    throw error
  }
}
```

**Checklist:**
- [ ] Файл создан
- [ ] Singleton pattern используется

---

#### Шаг 3.1.2: Создать health check endpoint

**Файл:** `/src/app/api/health/route.ts`
```typescript
import { NextResponse } from 'next/server'
import { initializeApp } from '@/lib/init'

let initializationPromise: Promise<void> | null = null

export async function GET() {
  // Инициализируем приложение при первом запросе
  if (!initializationPromise) {
    initializationPromise = initializeApp()
  }

  try {
    await initializationPromise
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

**Checklist:**
- [ ] Endpoint создан
- [ ] Инициализация вызывается
- [ ] Работает в production

---

#### Шаг 3.1.3: Настроить Railway Cron (опционально)

**Файл:** `/railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "cron": [
    {
      "schedule": "*/5 * * * *",
      "command": "curl -X POST https://syndicateadmin.up.railway.app/api/health"
    }
  ]
}
```

**Альтернатива:** Использовать внешний сервис (cron-job.org, EasyCron)

**Checklist:**
- [ ] Railway cron настроен ИЛИ внешний scheduler
- [ ] Cron вызывает /api/health
- [ ] Логи показывают работу cron

---

## Фаза 4: Валидация и обработка ошибок (Day 4, 4-6 часов)

### 4.1. Добавить валидацию в API routes

**Файл:** `/src/app/api/local-feeds/route.ts`

**Было:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { feedUrl } = body
  // Нет валидации!
}
```

**Стало:**
```typescript
import { AddFeedSchema } from '@/modules/feeds/schemas'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Валидация с Zod
    const validatedData = AddFeedSchema.parse(body)
    
    // Дальше безопасно использовать validatedData
    // ...
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

**Задачи:**
- [ ] Добавить валидацию в POST /api/local-feeds
- [ ] Добавить валидацию в PATCH /api/local-feeds
- [ ] Добавить валидацию в PATCH /api/materials
- [ ] Тестировать с невалидными данными

---

### 4.2. Создать Error Boundary

**Файл:** `/src/shared/components/ErrorBoundary.tsx`
```typescript
'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    // Отправить в Sentry/LogRocket
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center p-4">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Что-то пошло не так</h1>
            <p className="text-muted-foreground max-w-md">
              {this.state.error?.message || 'Неизвестная ошибка'}
            </p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
            >
              Перезагрузить страницу
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Использование в layout.tsx:**
```typescript
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

**Checklist:**
- [ ] ErrorBoundary создан
- [ ] Добавлен в layout
- [ ] Тестирован с ошибкой

---

## Фаза 5: Добавление пагинации (Day 5, 4-6 часов)

### 5.1. Обновить DB service

**Файл:** `/src/lib/db.ts`

Добавить метод:
```typescript
async getMaterialsPaginated(
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<{ materials: Material[]; total: number }> {
  const offset = (page - 1) * limit
  
  let query = `
    SELECT m.id, m.title, m.content, m.full_content as "fullContent", 
           m.thumbnail, m.author, m.created_at as "createdAt", 
           m.fetched_at as "fetchedAt", m.source, m.status,
           f.title as "feedName"
    FROM materials m
    LEFT JOIN feeds f ON m.source = f.url
  `
  
  const params: any[] = []
  
  if (status && status !== 'all') {
    query += ` WHERE m.status = $1`
    params.push(status)
  }
  
  query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(limit, offset)
  
  const countQuery = status && status !== 'all'
    ? `SELECT COUNT(*) FROM materials WHERE status = $1`
    : `SELECT COUNT(*) FROM materials`
  
  const [materialsResult, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, status && status !== 'all' ? [status] : []),
  ])
  
  return {
    materials: materialsResult.rows,
    total: parseInt(countResult.rows[0].count),
  }
}
```

**Checklist:**
- [ ] Метод добавлен
- [ ] Тестирован
- [ ] Работает с фильтрами

---

### 5.2. Обновить API endpoint

**Файл:** `/src/app/api/materials/route.ts`
```typescript
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const { materials, total } = await db.getMaterialsPaginated(page, limit, status)
    const stats = await db.getStats()
    
    return NextResponse.json({
      success: true,
      data: materials,
      stats: {
        total: parseInt(stats.total || '0'),
        new: parseInt(stats.new_count || '0'),
        processed: parseInt(stats.processed_count || '0'),
        archived: parseInt(stats.archived_count || '0'),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch materials' },
      { status: 500 }
    )
  }
}
```

---

### 5.3. Добавить UI для пагинации

**Файл:** `/src/modules/materials/components/Pagination.tsx`
```typescript
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between px-2">
      <div className="text-sm text-muted-foreground">
        Страница {currentPage} из {totalPages}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Вперед
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

**Checklist:**
- [ ] Компонент создан
- [ ] Интегрирован в MaterialsList
- [ ] Работает

---

## Фаза 6: Тестирование и финализация (Day 6-7, 6-8 часов)

### 6.1. Мануальное тестирование

**Checklist:**
- [ ] Добавление фида работает
- [ ] Список фидов отображается
- [ ] Редактирование названия работает
- [ ] Обновление фида работает
- [ ] Удаление фида работает
- [ ] Массовые операции работают
- [ ] Список материалов отображается
- [ ] Фильтрация по статусу работает
- [ ] Изменение статуса материала работает
- [ ] Пагинация работает
- [ ] Автоматическая синхронизация работает
- [ ] Toast уведомления корректны
- [ ] Error boundary ловит ошибки
- [ ] Валидация работает

---

### 6.2. Проверка производительности

**Задачи:**
- [ ] Время загрузки страниц < 1 сек
- [ ] API responses < 500ms
- [ ] Нет memory leaks
- [ ] React Query кеш работает

**Инструменты:**
- Chrome DevTools (Performance)
- React DevTools Profiler
- Network tab

---

### 6.3. Code Review

**Checklist:**
- [ ] Нет дублирования кода
- [ ] Все типы на месте
- [ ] Нет any типов
- [ ] Консольных логов минимум
- [ ] Комментарии где нужно
- [ ] Форматирование единообразное

---

### 6.4. Документация

**Обновить:**
- [ ] README.md с новой структурой
- [ ] API документация
- [ ] Changelog
- [ ] Deployment guide

---

## Фаза 7: Деплой (Day 7, 2-3 часа)

### 7.1. Подготовка к деплою

**Checklist:**
- [ ] .env.example обновлен
- [ ] railway.json обновлен
- [ ] Dependencies обновлены
- [ ] Build проходит без ошибок
- [ ] TypeScript без ошибок

---

### 7.2. Deployment на Railway

**Шаги:**
1. Создать staging окружение
2. Deploy в staging
3. Тестирование в staging
4. Deploy в production
5. Мониторинг логов

**Checklist:**
- [ ] Staging работает
- [ ] Production работает
- [ ] Cron job запускается
- [ ] БД мигрирована
- [ ] Логи чистые

---

## Критерии успеха рефакторинга

### ✅ Технические критерии
- [ ] Все модули разделены по слоям
- [ ] Нет прямых fetch вызовов в компонентах
- [ ] Все API responses типизированы
- [ ] Error boundaries работают
- [ ] Валидация на всех endpoints
- [ ] Пагинация реализована
- [ ] Cron вынесен из React
- [ ] React Query используется везде

### ✅ Функциональные критерии
- [ ] Вся старая функциональность работает
- [ ] Новая функциональность (пагинация) работает
- [ ] UX улучшен (toast вместо alert)
- [ ] Нет регрессий

### ✅ Качество кода
- [ ] Нет дублирования
- [ ] Типы корректны
- [ ] Код читабельный
- [ ] Комментарии где нужно

---

## Потенциальные риски

### Риск 1: Поломка существующей функциональности
**Вероятность:** Средняя  
**Митигация:** 
- Малые шаги
- Тестирование после каждого шага
- Git commits после каждой фазы

### Риск 2: Превышение времени
**Вероятность:** Высокая  
**Митигация:**
- Фокус на P0 задачи
- P1 и P2 опциональны
- Можно растянуть на 2 недели

### Риск 3: Railway downtime во время деплоя
**Вероятность:** Низкая  
**Митигация:**
- Staging окружение
- Деплой в низкий трафик время
- Rollback plan

---

## Следующие шаги после рефакторинга

### Приоритет P1 (после рефакторинга)
1. Добавить аутентификацию (NextAuth)
2. Добавить поиск по материалам
3. Добавить фильтры (по дате, источнику)
4. Добавить экспорт материалов

### Приоритет P2
5. Добавить теги для материалов
6. Добавить категории фидов
7. Добавить аналитику
8. Мобильная версия

---

## Заключение

Этот план рефакторинга поэтапно устранит все критические проблемы архитектуры без потери функциональности.

**Ключевые улучшения:**
1. ✅ Модульная архитектура
2. ✅ Разделение на слои
3. ✅ Типизация
4. ✅ Обработка ошибок
5. ✅ Пагинация
6. ✅ Исправление cron

**Результат:** Чистая кодовая база, готовая к добавлению нового функционала.

**Оценка:** 5-7 дней (можно растянуть на 2 недели)

---

**Документы:**
- `01_CODE_AUDIT.md` - Детальный аудит проблем
- `02_BUSINESS_REQUIREMENTS.md` - Бизнес-требования
- `03_REFACTORING_PLAN.md` (этот документ) - План исправления
- `04_ARCHITECTURE.md` - Новая архитектура (создать после рефакторинга)
