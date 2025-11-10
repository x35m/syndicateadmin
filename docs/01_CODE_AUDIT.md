# Аудит кода и архитектуры проекта Syndicate Admin

**Дата:** 10 ноября 2025  
**Версия:** 1.0  
**Статус:** Критические проблемы обнаружены

---

## Резюме

Проект находится в рабочем состоянии, но имеет **критические архитектурные проблемы**, которые блокируют добавление нового функционала. Основные проблемы: отсутствие слоев архитектуры, тесная связанность компонентов, дублирование кода, слабая обработка ошибок.

**Рекомендация:** Требуется рефакторинг с сохранением существующей функциональности.

---

## 1. Критические проблемы (блокеры)

### 1.1. Отсутствие архитектурных слоев ⚠️ КРИТИЧНО

**Проблема:**  
Код не разделен на слои (Presentation, Business Logic, Data Access). Вся логика смешана в компонентах React.

**Пример проблемного кода:**
```typescript
// app/page.tsx - бизнес-логика внутри UI компонента
const handleSync = async () => {
  setSyncing(true)
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
    })
    // ...обработка
  } catch (error) {
    alert('Ошибка при синхронизации') // alert вместо toast!
  }
}
```

**Последствия:**
- Невозможно переиспользовать логику
- Сложно тестировать
- Дублирование кода
- Трудно добавлять новые функции

**Решение:**
Создать слоистую архитектуру:
```
/services       - бизнес-логика
/api/client     - HTTP клиент
/hooks          - переиспользуемые хуки
/components     - только UI
```

---

### 1.2. Cron Job в Layout Component ⚠️ КРИТИЧНО

**Проблема:**  
Cron job инициализируется в `layout.tsx` - это клиентский компонент React, который не должен отвечать за фоновые задачи.

**Код:**
```typescript
// app/layout.tsx
'use client'
import { useEffect } from 'react'
import { initCronJob, runInitialFetch } from '@/lib/cron'

export default function RootLayout({ children }) {
  useEffect(() => {
    runInitialFetch()
    initCronJob()
  }, [])
  // ...
}
```

**Последствия:**
- Cron может не запуститься при холодном старте
- Перезапуск при каждом ре-рендере layout
- Railway может "усыпить" приложение - cron остановится
- Не работает на serverless платформах

**Решение:**
Перенести cron в отдельный процесс или использовать внешний scheduler.

---

### 1.3. Нет обработки ошибок ⚠️ КРИТИЧНО

**Проблема:**  
Ошибки API игнорируются или показываются через `alert()`, нет graceful degradation.

**Примеры:**
```typescript
// app/page.tsx
} catch (error) {
  console.error('Error fetching stats:', error)
  // Ошибка проглатывается - UI не уведомлен!
}

// components/feed-manager.tsx
} catch (error) {
  alert('Ошибка при добавлении фида') // Плохой UX
}
```

**Последствия:**
- Пользователь не понимает, что произошло
- Нет логирования для отладки
- Нет retry механизмов
- Приложение может "зависнуть" без обратной связи

**Решение:**
- Централизованная обработка ошибок
- Toast уведомления (sonner уже установлен, но не везде используется)
- Error boundaries для React
- Логирование в Sentry/LogRocket

---

### 1.4. Отсутствие типизации API ⚠️ КРИТИЧНО

**Проблема:**  
API ответы не типизированы, возможны runtime ошибки.

**Пример:**
```typescript
const response = await fetch('/api/stats')
const result = await response.json() // any!

if (result.success) { // может не быть success
  setStats(result.data) // может быть undefined
}
```

**Последствия:**
- Runtime ошибки
- Нет автодополнения в IDE
- Сложно отлаживать
- Нарушение контракта между frontend/backend

**Решение:**
Создать типы для всех API endpoints:
```typescript
// types/api.ts
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface StatsData {
  total: number
  new: number
  processed: number
  archived: number
  lastFetch: string | null
}
```

---

## 2. Серьёзные проблемы

### 2.1. Дублирование fetch логики

**Проблема:**  
Каждый компонент делает fetch самостоятельно - дублирование кода.

**Найдено в:**
- `app/page.tsx` - fetchStats
- `components/feed-manager.tsx` - fetchFeeds, handleAddFeed, handleImportFeed
- `app/materials/page.tsx` (предположительно)

**Решение:**
Создать централизованный API client:
```typescript
// lib/api-client.ts
export const apiClient = {
  stats: {
    get: () => fetch('/api/stats').then(r => r.json()),
  },
  feeds: {
    list: () => fetch('/api/local-feeds').then(r => r.json()),
    add: (url: string) => fetch('/api/local-feeds', {
      method: 'POST',
      body: JSON.stringify({ feedUrl: url })
    }).then(r => r.json()),
  }
}
```

---

### 2.2. Прямые SQL запросы в DatabaseService

**Проблема:**  
SQL запросы захардкожены в `lib/db.ts`. Сложно менять схему БД.

**Код:**
```typescript
await client.query(`
  CREATE TABLE IF NOT EXISTS materials (
    id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    // ...
  )
`)
```

**Последствия:**
- Нет миграций
- Сложно откатывать изменения
- Нет версионирования схемы
- Невозможно использовать ORM

**Решение:**
Использовать ORM (Prisma, Drizzle) или миграции (node-pg-migrate).

---

### 2.3. Нет валидации входных данных

**Проблема:**  
API endpoints не валидируют входные данные.

**Код:**
```typescript
// app/api/materials/route.ts
export async function PATCH(request: NextRequest) {
  const body = await request.json() // любые данные!
  const { id, status } = body
  
  if (!id || !status) { // только базовая проверка
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
  }
  
  await db.updateMaterialStatus(id, status) // status может быть invalid
}
```

**Последствия:**
- SQL injection риск (хотя используется parameterized queries)
- Невалидные данные в БД
- Сложно отлаживать ошибки

**Решение:**
Использовать Zod для валидации:
```typescript
import { z } from 'zod'

const UpdateMaterialSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'processed', 'archived'])
})

// в route.ts
const body = UpdateMaterialSchema.parse(await request.json())
```

---

### 2.4. Отсутствие кеширования

**Проблема:**  
Каждый запрос идет в БД, нет кеша для часто запрашиваемых данных.

**Последствия:**
- Медленная работа
- Высокая нагрузка на БД
- Плохой UX при медленном интернете

**Решение:**
- React Query для client-side кеширования
- Redis для server-side кеша (опционально)

---

## 3. Проблемы дизайна

### 3.1. Нет разделения на модули

**Проблема:**  
Весь код в одном уровне - нет модульной структуры.

**Текущая структура:**
```
/app
  /api
  /materials
  page.tsx
  layout.tsx
/lib
  cron.ts
  db.ts
  rss-parser.ts
/components
  feed-manager.tsx
  header.tsx
```

**Проблемы:**
- Сложно найти нужный файл
- Непонятные зависимости между модулями
- Невозможно переиспользовать код

**Решение:**
Модульная структура по доменам:
```
/src
  /modules
    /feeds
      /api
      /components
      /hooks
      /services
    /materials
      /api
      /components
      /hooks
      /services
  /shared
    /components
    /hooks
    /utils
```

---

### 3.2. Тесная связанность компонентов

**Проблема:**  
Компоненты знают о структуре API и БД - нарушение принципа единственной ответственности.

**Пример:**
```typescript
// feed-manager.tsx знает о структуре API
const response = await fetch('/api/local-feeds')
const result = await response.json()
if (result.success) { // зависимость от структуры ответа
  setFeeds(result.data)
}
```

**Решение:**
Использовать custom hooks:
```typescript
// hooks/useFeeds.ts
export function useFeeds() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['feeds'],
    queryFn: feedsService.getAll
  })
  
  return { feeds: data, isLoading, error, refetch }
}

// feed-manager.tsx - только UI
const { feeds, isLoading, error } = useFeeds()
```

---

## 4. Проблемы производительности

### 4.1. Нет пагинации

**Проблема:**  
`getAllMaterials()` возвращает ВСЕ материалы - может быть тысячи записей.

**Код:**
```typescript
// lib/db.ts
async getAllMaterials(): Promise<Material[]> {
  const result = await pool.query(
    `SELECT * FROM materials ORDER BY created_at DESC` // все записи!
  )
  return result.rows
}
```

**Последствия:**
- Медленная загрузка
- Высокое потребление памяти
- Плохой UX

**Решение:**
```typescript
async getMaterialsPaginated(page: number, limit: number = 20) {
  const offset = (page - 1) * limit
  const result = await pool.query(
    `SELECT * FROM materials 
     ORDER BY created_at DESC 
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return result.rows
}
```

---

### 4.2. N+1 проблема в fetchFeeds

**Проблема:**  
Bulk actions делают отдельный запрос для каждого фида.

**Код:**
```typescript
// feed-manager.tsx
for (const id of idsArray) {
  await handleImportFeed(id, true) // N запросов!
}
```

**Решение:**
Batch API endpoint:
```typescript
// api/local-feeds/import-batch/route.ts
POST /api/local-feeds/import-batch
{ feedIds: ['id1', 'id2', 'id3'] }
```

---

## 5. Проблемы безопасности

### 5.1. Нет rate limiting

**Проблема:**  
API endpoints не защищены от abuse.

**Решение:**
Использовать middleware для rate limiting (upstash/ratelimit).

---

### 5.2. CORS не настроен

**Проблема:**  
Нет явной настройки CORS - потенциальная уязвимость.

**Решение:**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  return response
}
```

---

## 6. Технический долг

### 6.1. Нет тестов
- Нет unit тестов
- Нет integration тестов
- Нет E2E тестов

### 6.2. Нет документации API
- Нет OpenAPI/Swagger спецификации
- Нет описания endpoints

### 6.3. Устаревшие зависимости
- Next.js 14.2.5 (текущая: 15.x)
- Нужно обновить зависимости

### 6.4. Нет логирования
- console.log вместо структурированных логов
- Нет отправки логов в внешний сервис

---

## Приоритизация проблем

### P0 - Критичные (блокеры добавления функционала)
1. ⚠️ Отсутствие архитектурных слоев
2. ⚠️ Cron job в layout
3. ⚠️ Нет обработки ошибок
4. ⚠️ Отсутствие типизации API

### P1 - Высокий приоритет
5. Дублирование fetch логики
6. Прямые SQL запросы
7. Нет валидации данных
8. Нет пагинации

### P2 - Средний приоритет
9. Нет модульной структуры
10. Тесная связанность
11. N+1 проблема
12. Нет кеширования

### P3 - Низкий приоритет
13. Нет тестов
14. Нет документации API
15. Устаревшие зависимости
16. Нет логирования

---

## Выводы

Проект **работает**, но добавление нового функционала **заблокировано** из-за архитектурных проблем. Необходим **поэтапный рефакторинг** с приоритетом на:

1. Создание архитектурных слоев
2. Централизация API логики
3. Добавление типизации
4. Улучшение обработки ошибок

**Оценка времени на рефакторинг:** 3-5 дней (с сохранением функционала)

**Следующий документ:** `02_BUSINESS_REQUIREMENTS.md`
