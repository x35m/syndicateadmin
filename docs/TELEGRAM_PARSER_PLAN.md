# Telegram Parser Implementation Plan (Next.js / Syndicate)

> Цель: добавить поддержку публичных Telegram‑каналов наравне с RSS-фидами в существующем приложении (Next.js 14 App Router + Postgres). План разбит на 8 фаз, каждая содержит конкретные задачи и ожидаемые артефакты, привязанные к текущей структуре репозитория.

---

## Фаза 0 — Подготовка окружения

- [ ] Получить `TELEGRAM_API_ID` и `TELEGRAM_API_HASH`, добавить в `.env.local` и `docs/SETUP.md`.
- [ ] Установить библиотеку [`gramjs`](https://github.com/gram-js/gramjs) (TypeScript SDK Telegram) + типы:  
  `npm install telegram`  
  `npm install -D @types/telegram__tl`
- [ ] Добавить `telegram_session/` в `.gitignore`.

---

## Фаза 1 — Схема БД и репозиторий

1. **Миграции (через `lib/db.ts` init-block)**  
   - Создать таблицу `telegram_channels` (Postgres):
     ```sql
     CREATE TABLE IF NOT EXISTS telegram_channels (
       id SERIAL PRIMARY KEY,
       username VARCHAR(255) NOT NULL UNIQUE,
       title TEXT,
       description TEXT,
       subscribers_count INTEGER,
       is_active BOOLEAN NOT NULL DEFAULT TRUE,
       last_parsed TIMESTAMP,
       created_at TIMESTAMP NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMP NOT NULL DEFAULT NOW()
     );
     CREATE INDEX IF NOT EXISTS idx_telegram_channels_active ON telegram_channels(is_active);
     ```
   - В таблицу `materials` добавить колонки:
     ```sql
     ALTER TABLE materials
       ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NOT NULL DEFAULT 'rss',
       ADD COLUMN IF NOT EXISTS telegram_message_id VARCHAR(255);
     CREATE INDEX IF NOT EXISTS idx_materials_source_type ON materials(source_type);
     ```

2. **Методы в `lib/db.ts`**  
   - CRUD для `telegram_channels` (получение списка, добавление, обновление активного статуса, отметка `last_parsed`).  
   - Поиск материала по `telegram_message_id` для дедупликации.

---

## Фаза 2 — Telegram клиент и парсер

- Создать модуль `lib/telegram/client.ts`:
  - Инициализация `TelegramClient` (GramJS) с reuse session.
  - Методы `ensureStarted()`, `stop()`, `getChannel(username)`, `iterMessages`.
- Создать `lib/telegram/parser.ts`:
  - `validateChannel(username)` → `{ valid, title, subscribers, error }`.
  - `fetchChannelPosts({ username, limit, offsetDate })` → массив нормализованных материалов (`MaterialInput`):
    ```ts
    type TelegramMaterial = {
      id: string // `<username>#<message.id>`
      title: string
      content: string
      createdAt: string
      link: string
      source: string
      sourceType: 'telegram'
      telegramMessageId: string
      metadata: { views?: number; forwards?: number }
    }
    ```
- Обработка FloodWait с экспоненциальной задержкой и логированием через `lib/logger`.

---

## Фаза 3 — API и админ-интерфейс каналов

1. **REST API (`app/api/telegram-channels`)**
   - `GET /api/telegram-channels` — список каналов.
   - `POST` — валидация username через `validateChannel`, сохранение в БД.
   - `PATCH /:id` — изменение `is_active`.
   - `DELETE /:id`.
   - `POST /:id/refresh` — ручной запуск парсинга для конкретного канала.

2. **UI (страница `app/admin/telegram/page.tsx`)**
   - Лист каналов, добавление нового, переключение активности, ручной refresh (спиннер + тосты).
   - Ссылки из админ-меню.

---

## Фаза 4 — Интеграция в Cron / Automation

- Расширить `lib/cron.ts`:
  - Добавить шаг `fetchTelegramChannels()` после RSS.
  - Использовать параметры: лимит сообщений (по умолчанию 50), окно по времени (не старше 48 часов).
  - Каждый успешно распарсенный канал → `db.saveMaterials` c атрибутами `sourceType = 'telegram'`, `telegram_message_id`.
- Логи о количестве новых/обновлённых Telegram материалов выводить и в `system_logs`.

---

## Фаза 5 — Настройки и таксономия

- В `app/admin/settings` добавить блок `Telegram`:
  - Поля для `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, опция «макс. сообщений за проход».
  - Сохранение через `/api/settings`.
- В `lib/db.saveMaterials` учитывать, что Telegram материалы могут не иметь `thumbnail`; использовать fallback (первая ссылка/эмодзи).  
- Процессинг/таксономия остаётся прежней: после импорта Telegram сообщений automation step «processing» генерирует summary так же, как для RSS.

---

## Фаза 6 — Тестирование

- **Юнит**:  
  - Моки клиента (`telegram/client.mock.ts`), тесты для `parser.ts` (Jest).  
  - Тесты на `db` методы для `telegram_channels`.
- **Интеграция**: скрипт `scripts/test-telegram.ts` (Node, ts-node) → читает `.env`, парсит `bbcrussian`, выводит 3 последних сообщения.
- **E2E/Admin UI**: Playwright сценарий добавления/отключения канала.

---

## Фаза 7 — Документация и деплой

- Обновить `README.md` (секция «Telegram Channels»).
- Добавить `docs/TELEGRAM_SETUP.md` (адаптировать раздел из исходного плана).
- Обновить `RAILWAY_DEPLOY.md` — добавить vars и упоминание `telegram_session.session`.

---

## Контрольный чек-лист

- [ ] Таблицы/индексы созданы.
- [ ] CRUD API и UI работают.
- [ ] Cron подтягивает Telegram посты.
- [ ] Automation → processing → publishing проходит для Telegram материалов.
- [ ] Unit + интеграционные тесты зелёные.
- [ ] Документация обновлена.

---

## Дорожная карта внедрения

| Шаг | Что делаем | Выход |
| --- | ---------- | ----- |
| 1 | Реализовать фазу 1 (schema + `db.ts`) | миграции, методы |
| 2 | Фаза 2 (клиент + парсер) | `lib/telegram/*` |
| 3 | Фаза 3 (API + UI) | REST + страница в админке |
| 4 | Фаза 4 (cron интеграция) | импорт сообщений в `materials` |
| 5 | Фаза 5 (настройки) | UI/сохранение env |
| 6 | Фаза 6-7 | тесты + docs |

Каждый шаг оформляем отдельным MR/коммитом с проверкой линтеров и ручным тестом.


