# 🔧 Пошаговая настройка API

Эта инструкция поможет вам настроить подключение к вашему API.

## ⚠️ ВАЖНО: Что нужно настроить

Прямо сейчас приложение НЕ будет работать, пока вы не настроите подключение к API.
Вам нужно узнать:

1. **Эндпоинт API** - URL для получения материалов
2. **Метод аутентификации** - как API проверяет доступ
3. **Структуру данных** - какие поля возвращает API

## 📖 Шаг 1: Изучите документацию API

Перейдите на страницу документации:
```
https://organic-kangaroo.pikapod.net/api-documentation/
```

Найдите ответы на вопросы:

### A. Какой эндпоинт использовать?

Примеры возможных эндпоинтов:
- `/api/materials`
- `/api/posts`
- `/api/content/latest`
- `/api/v1/items`

### B. Нужна ли аутентификация?

Возможные варианты:
- **Bearer Token**: `Authorization: Bearer YOUR_TOKEN`
- **API Key в заголовке**: `X-API-Key: YOUR_KEY`
- **API Key в URL**: `?api_key=YOUR_KEY`
- **Без аутентификации**: открытый API

### C. Какие данные возвращает API?

Пример ответа может выглядеть так:
```json
{
  "data": [
    {
      "id": "123",
      "title": "Example Post",
      "body": "Content here...",
      "author": {
        "name": "John Doe"
      },
      "created_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

## 🛠 Шаг 2: Настройте lib/api-service.ts

### 2.1 Измените эндпоинт

Откройте `lib/api-service.ts` и найдите строку:

```typescript
const url = `${this.baseUrl}/api/materials`
```

Замените `/api/materials` на реальный эндпоинт из документации.

**Пример:**
```typescript
// Если эндпоинт /api/v1/posts
const url = `${this.baseUrl}/api/v1/posts`

// Если эндпоинт /content/recent
const url = `${this.baseUrl}/content/recent`
```

### 2.2 Настройте аутентификацию

Найдите метод `fetchWithAuth()`:

**Вариант 1: Bearer Token**
```typescript
if (this.apiKey) {
  headers['Authorization'] = `Bearer ${this.apiKey}`
}
```

**Вариант 2: API Key в заголовке**
```typescript
if (this.apiKey) {
  headers['X-API-Key'] = this.apiKey
}
```

**Вариант 3: API Key в URL**
```typescript
const url = `${this.baseUrl}/api/materials?api_key=${this.apiKey}`
```

**Вариант 4: Без аутентификации**
```typescript
// Просто уберите проверку apiKey
```

### 2.3 Настройте трансформацию данных

Найдите метод `transformApiResponse()`. Это самая важная часть!

**Пример 1: Данные в массиве**
```typescript
// API возвращает: [{ id: 1, title: "...", body: "..." }]
private transformApiResponse(data: any): Material[] {
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      id: String(item.id),
      title: item.title,
      content: item.body,
      author: item.author?.name,
      createdAt: item.created_at,
      fetchedAt: new Date().toISOString(),
      source: this.baseUrl,
      status: 'new' as const,
    }))
  }
  return []
}
```

**Пример 2: Данные в объекте data**
```typescript
// API возвращает: { data: [{ id: 1, ... }] }
private transformApiResponse(data: any): Material[] {
  const items = data.data || []
  return items.map((item: any) => ({
    id: String(item.id),
    title: item.title,
    content: item.content,
    author: item.author,
    createdAt: item.createdAt,
    fetchedAt: new Date().toISOString(),
    source: this.baseUrl,
    status: 'new' as const,
  }))
}
```

**Пример 3: Данные в объекте results**
```typescript
// API возвращает: { results: [{ id: 1, ... }], total: 50 }
private transformApiResponse(data: any): Material[] {
  const items = data.results || []
  return items.map((item: any) => ({
    id: String(item.id),
    title: item.title || 'Untitled',
    content: item.description || '',
    author: item.user?.username,
    createdAt: item.timestamp,
    fetchedAt: new Date().toISOString(),
    source: this.baseUrl,
    status: 'new' as const,
  }))
}
```

## 🧪 Шаг 3: Протестируйте локально

### 3.1 Создайте .env файл

```env
API_BASE_URL=https://organic-kangaroo.pikapod.net
API_KEY=your_actual_api_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/materials
NODE_ENV=development
```

### 3.2 Запустите PostgreSQL локально

**С Docker:**
```bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=materials \
  -p 5432:5432 \
  postgres:15
```

**Или установите PostgreSQL нативно:**
- Mac: `brew install postgresql`
- Ubuntu: `apt-get install postgresql`

### 3.3 Запустите приложение

```bash
npm install
npm run dev
```

### 3.4 Проверьте подключение

1. Откройте http://localhost:3000
2. Нажмите кнопку "Синхронизировать"
3. Проверьте логи в терминале:
   - Видите ошибку? → Идите к Шагу 4
   - Материалы загружаются? → Отлично! Переходите к деплою

## 🐛 Шаг 4: Отладка

### Включите подробные логи

В `lib/api-service.ts` добавьте в метод `fetchNewMaterials()`:

```typescript
async fetchNewMaterials(): Promise<Material[]> {
  try {
    const url = `${this.baseUrl}/api/materials`
    console.log('Fetching from:', url)
    
    const data = await this.fetchWithAuth(url)
    console.log('Received data:', JSON.stringify(data, null, 2))
    
    const transformed = this.transformApiResponse(data)
    console.log('Transformed materials:', transformed.length)
    
    return transformed
  } catch (error) {
    console.error('Detailed error:', error)
    throw error
  }
}
```

### Проверьте в браузере

Откройте DevTools (F12) и перейдите на вкладку Network:
1. Нажмите "Синхронизировать"
2. Найдите запрос к `/api/sync`
3. Посмотрите что возвращает ваш внешний API

### Тестируйте API напрямую

Используйте curl:
```bash
# Без аутентификации
curl https://organic-kangaroo.pikapod.net/api/materials

# С Bearer Token
curl -H "Authorization: Bearer YOUR_KEY" \
  https://organic-kangaroo.pikapod.net/api/materials

# С API Key в заголовке
curl -H "X-API-Key: YOUR_KEY" \
  https://organic-kangaroo.pikapod.net/api/materials
```

## ✅ Шаг 5: Готово к деплою!

Когда всё работает локально:

1. Закоммитьте изменения:
```bash
git add .
git commit -m "Configure API integration"
git push
```

2. Следуйте инструкциям из README.md для деплоя на Railway

## 💡 Подсказки

### Если API возвращает пустой массив

- Убедитесь что в API есть данные
- Проверьте фильтры или параметры запроса
- Возможно нужно добавить `?limit=50` к URL

### Если получаете 401/403

- Проверьте API ключ
- Убедитесь что формат аутентификации правильный
- Возможно API требует регистрации

### Если структура данных непонятна

Временно добавьте в `transformApiResponse()`:
```typescript
console.log('Raw API response:', JSON.stringify(data, null, 2))
```

Это выведет в консоль полную структуру данных из API.

## 📞 Нужна помощь?

1. Проверьте логи в терминале
2. Изучите документацию API внимательно
3. Попробуйте разные эндпоинты из документации
4. Проверьте примеры запросов в документации API

Удачи! 🚀
