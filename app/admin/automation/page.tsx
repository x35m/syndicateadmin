'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  DEFAULT_AUTOMATION_CONFIG,
  normalizeAutomationConfig,
} from '@/lib/automation-config'
import type {
  AutomationConfig,
  AutomationImportConfig,
  AutomationProcessingConfig,
  AutomationPublishingConfig,
} from '@/lib/types'

interface FeedSummary {
  id: number
  title?: string | null
  url: string
  status: 'active' | 'inactive' | 'deleted'
  lastFetched?: string | null
}

interface CategorySummary {
  id: number
  name: string
  isHidden?: boolean
}

const FEED_SCOPE_OPTIONS: Array<{ value: AutomationImportConfig['scope']; label: string }> = [
  { value: 'all', label: 'Все активные фиды' },
  { value: 'selected', label: 'Выбранные фиды' },
]

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU')
}

function FeedList({
  feeds,
  selectedFeedIds,
  onToggle,
}: {
  feeds: FeedSummary[]
  selectedFeedIds: number[]
  onToggle: (id: number) => void
}) {
  if (feeds.length === 0) {
    return <p className="text-sm text-muted-foreground">Фиды не найдены.</p>
  }

  return (
    <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/30 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {feeds.map((feed) => {
          const disabled = feed.status !== 'active'
          const checked = selectedFeedIds.includes(feed.id)
          return (
            <label
              key={feed.id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors ${
                disabled
                  ? 'border-muted bg-muted/20 text-muted-foreground'
                  : 'border-transparent bg-background hover:border-primary/40'
              }`}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => onToggle(feed.id)}
              />
              <div className="flex flex-col gap-1">
                <span className="font-medium leading-tight">
                  {feed.title || feed.url}
                </span>
                <span className="text-xs text-muted-foreground break-all">
                  {feed.url}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant={feed.status === 'active' ? 'default' : 'secondary'}>
                    {feed.status === 'active' ? 'Активен' : 'Отключен'}
                  </Badge>
                  {feed.lastFetched && (
                    <span className="text-muted-foreground">
                      Последний импорт: {formatDateTime(feed.lastFetched)}
                    </span>
                  )}
                </div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function CategoryList({
  categories,
  selectedCategoryIds,
  scope,
  onScopeChange,
  onToggle,
}: {
  categories: CategorySummary[]
  selectedCategoryIds: number[]
  scope: AutomationPublishingConfig['scope']
  onScopeChange: (scope: AutomationPublishingConfig['scope']) => void
  onToggle: (id: number) => void
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">Категории не найдены.</p>
  }

  const handleScopeToggle = (value: boolean) => {
    onScopeChange(value ? 'all' : 'selected')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
        <div>
          <p className="text-sm font-medium">Диапазон категорий</p>
          <p className="text-xs text-muted-foreground">
            Выберите «Все категории» или отметьте конкретные для автопубликации.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={scope === 'all'}
            onCheckedChange={(value) => handleScopeToggle(value === true)}
          />
          Все категории
        </label>
      </div>

      {scope === 'all' ? (
        <p className="text-sm text-muted-foreground">
          Будут публиковаться все материалы, относящиеся к видимым категориям.
          Чтобы сузить пул, отключите опцию «Все категории» и отметьте нужные.
        </p>
      ) : (
        <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/30 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent bg-background p-3 text-sm transition-colors hover:border-primary/40"
              >
                <Checkbox
                  checked={selectedCategoryIds.includes(category.id)}
                  onCheckedChange={() => onToggle(category.id)}
                />
                <div className="flex flex-col gap-1">
                  <span className="font-medium leading-tight">
                    {category.name}
                  </span>
                  {category.isHidden && (
                    <span className="text-xs text-muted-foreground">Категория скрыта</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function cloneConfig(config: AutomationConfig): AutomationConfig {
  return JSON.parse(JSON.stringify(config)) as AutomationConfig
}

function snapshotConfig(config: AutomationConfig): string {
  return JSON.stringify({
    import: { ...config.import, lastRunAt: null },
    processing: { ...config.processing, lastRunAt: null },
    publishing: { ...config.publishing, lastRunAt: null },
  })
}

export default function AutomationPage() {
  const [config, setConfig] = useState<AutomationConfig>(cloneConfig(DEFAULT_AUTOMATION_CONFIG))
  const [initialConfig, setInitialConfig] = useState<AutomationConfig | null>(null)
  const [feeds, setFeeds] = useState<FeedSummary[]>([])
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [automationRes, feedsRes, taxonomyRes] = await Promise.all([
        fetch('/api/automation', { cache: 'no-store' }),
        fetch('/api/local-feeds', { cache: 'no-store' }),
        fetch('/api/taxonomy', { cache: 'no-store' }),
      ])

      const automationJson = await automationRes.json()
      if (!automationRes.ok || automationJson.success === false) {
        throw new Error(automationJson.error || 'Не удалось получить настройки автоматизации')
      }

      const feedsJson = await feedsRes.json()
      if (!feedsRes.ok || feedsJson.success === false) {
        throw new Error(feedsJson.error || 'Не удалось получить список фидов')
      }

      const taxonomyJson = await taxonomyRes.json()
      if (!taxonomyRes.ok || taxonomyJson.success === false) {
        throw new Error(taxonomyJson.error || 'Не удалось получить категории')
      }

      const normalizedConfig = normalizeAutomationConfig(automationJson.data)
      setConfig(cloneConfig(normalizedConfig))
      setInitialConfig(cloneConfig(normalizedConfig))

      const normalizedFeeds: FeedSummary[] = (feedsJson.data ?? []).map((feed: any) => ({
        id: Number(feed.id),
        title: feed.title ?? feed.name ?? null,
        url: feed.url,
        status: feed.status ?? 'active',
        lastFetched: feed.lastFetched ?? feed.last_fetched ?? null,
      }))
      setFeeds(normalizedFeeds)

      const normalizedCategories: CategorySummary[] = (taxonomyJson.data?.categories ?? []).map((category: any) => ({
        id: Number(category.id),
        name: category.name,
        isHidden: Boolean(category.isHidden ?? category.is_hidden),
      }))
      setCategories(normalizedCategories)
    } catch (error) {
      console.error('Automation fetch error:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка при загрузке данных')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const isDirty = useMemo(() => {
    if (!initialConfig) return false
    return snapshotConfig(config) !== snapshotConfig(initialConfig)
  }, [config, initialConfig])

  const updateImport = (changes: Partial<AutomationImportConfig>) => {
    setConfig((prev) => ({
      ...prev,
      import: { ...prev.import, ...changes },
    }))
  }

  const updateProcessing = (changes: Partial<AutomationProcessingConfig>) => {
    setConfig((prev) => ({
      ...prev,
      processing: { ...prev.processing, ...changes },
    }))
  }

  const updatePublishing = (changes: Partial<AutomationPublishingConfig>) => {
    setConfig((prev) => ({
      ...prev,
      publishing: { ...prev.publishing, ...changes },
    }))
  }

  const handleToggleFeed = (feedId: number) => {
    updateImport({
      feedIds: config.import.feedIds.includes(feedId)
        ? config.import.feedIds.filter((id) => id !== feedId)
        : [...config.import.feedIds, feedId],
    })
  }

  const handleToggleCategory = (categoryId: number) => {
    if (config.publishing.scope !== 'selected') {
      updatePublishing({ scope: 'selected' })
    }
    updatePublishing({
      categoryIds: config.publishing.categoryIds.includes(categoryId)
        ? config.publishing.categoryIds.filter((id) => id !== categoryId)
        : [...config.publishing.categoryIds, categoryId],
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const result = await response.json()

      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось сохранить настройки')
      }

      const normalized = normalizeAutomationConfig(result.data)
      setConfig(cloneConfig(normalized))
      setInitialConfig(cloneConfig(normalized))
      toast.success('Настройки автоматизации сохранены')
    } catch (error) {
      console.error('Automation save error:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка при сохранении настроек')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (initialConfig) {
      setConfig(cloneConfig(initialConfig))
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Автоматизация процессов</h1>
            <p className="text-muted-foreground max-w-2xl">
              Настройте автоматический импорт материалов, обработку и публикацию. Система учитывает только активные RSS фиды и доступные категории.
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Автоматический импорт RSS</CardTitle>
                  <CardDescription>
                    Выполняет импорт материалов с выбранной периодичностью. При выборе конкретных фидов используются только активные источники.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                    <div>
                      <p className="font-medium">Включить автоимпорт</p>
                      <p className="text-sm text-muted-foreground">
                        {config.import.enabled ? 'Автоимпорт активен' : 'Автоимпорт отключен'}
                      </p>
                    </div>
                    <Checkbox
                      checked={config.import.enabled}
                      onCheckedChange={(value) =>
                        updateImport({ enabled: value === true })
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Интервал (минуты)</label>
                      <Input
                        type="number"
                        min={1}
                        value={config.import.intervalMinutes}
                        onChange={(event) =>
                          updateImport({
                            intervalMinutes: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Источники</label>
                      <div className="flex flex-wrap gap-2">
                        {FEED_SCOPE_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={config.import.scope === option.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateImport({ scope: option.value })}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {config.import.scope === 'selected' && (
                    <FeedList
                      feeds={feeds}
                      selectedFeedIds={config.import.feedIds}
                      onToggle={handleToggleFeed}
                    />
                  )}

                  <p className="text-xs text-muted-foreground">
                    Последний запуск: {formatDateTime(config.import.lastRunAt)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Автообработка материалов</CardTitle>
                  <CardDescription>
                    Генерация саммари и таксономии для новых материалов. Обработка происходит последовательно, чтобы избежать перегрузки AI моделей.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                    <div>
                      <p className="font-medium">Включить автообработку</p>
                      <p className="text-sm text-muted-foreground">
                        {config.processing.enabled ? 'Автообработка активна' : 'Автообработка отключена'}
                      </p>
                    </div>
                    <Checkbox
                      checked={config.processing.enabled}
                      onCheckedChange={(value) =>
                        updateProcessing({ enabled: value === true })
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Интервал (минуты)</label>
                      <Input
                        type="number"
                        min={1}
                        value={config.processing.intervalMinutes}
                        onChange={(event) =>
                          updateProcessing({
                            intervalMinutes: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Материалов за запуск</label>
                      <Input
                        type="number"
                        min={1}
                        value={config.processing.batchSize}
                        onChange={(event) =>
                          updateProcessing({
                            batchSize: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Последний запуск: {formatDateTime(config.processing.lastRunAt)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Автопубликация материалов</CardTitle>
                  <CardDescription>
                    Публикация обработанных материалов с указанной периодичностью. Можно ограничить публикацию определёнными категориями.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                    <div>
                      <p className="font-medium">Включить автопубликацию</p>
                      <p className="text-sm text-muted-foreground">
                        {config.publishing.enabled ? 'Автопубликация активна' : 'Автопубликация отключена'}
                      </p>
                    </div>
                    <Checkbox
                      checked={config.publishing.enabled}
                      onCheckedChange={(value) =>
                        updatePublishing({ enabled: value === true })
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Интервал (минуты)</label>
                      <Input
                        type="number"
                        min={1}
                        value={config.publishing.intervalMinutes}
                        onChange={(event) =>
                          updatePublishing({
                            intervalMinutes: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Материалов за запуск</label>
                      <Input
                        type="number"
                        min={1}
                        value={config.publishing.batchSize}
                        onChange={(event) =>
                          updatePublishing({
                            batchSize: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                      />
                    </div>
                  </div>

                  <CategoryList
                    categories={categories}
                    selectedCategoryIds={config.publishing.categoryIds}
                    scope={config.publishing.scope}
                    onScopeChange={(nextScope) => updatePublishing({ scope: nextScope })}
                    onToggle={handleToggleCategory}
                  />

                  <p className="text-xs text-muted-foreground">
                    Последний запуск: {formatDateTime(config.publishing.lastRunAt)}
                  </p>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                >
                  {saving ? 'Сохранение...' : 'Сохранить настройки'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={!isDirty || saving}
                >
                  Сбросить изменения
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
