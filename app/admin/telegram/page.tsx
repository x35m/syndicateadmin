'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Power, PowerOff, RefreshCw, Trash2, Save } from 'lucide-react'

interface TelegramChannel {
  id: number
  username: string
  title?: string | null
  description?: string | null
  subscribersCount?: number | null
  isActive: boolean
  lastParsed?: string | null
  createdAt: string
  updatedAt: string
}

interface SettingsPayload {
  geminiApiKey: string
  claudeApiKey: string
  aiProvider: 'gemini' | 'claude'
  geminiModel: string
  claudeModel: string
  analysisPrompt: string
  summaryPrompt: string
  taxonomySystemPrompt?: string
  taxonomyFormatPrompt?: string
  telegramApiId: string
  telegramApiHash: string
  telegramSession: string
  telegramFetchLimit: number
}

export default function TelegramChannelsPage() {
  const [channels, setChannels] = useState<TelegramChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [configReady, setConfigReady] = useState(true)
  const [configMessage, setConfigMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)
  const [settings, setSettings] = useState<SettingsPayload | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  const loadChannels = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/telegram-channels', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось загрузить каналы')
      }
      setChannels(result.data ?? [])
      setConfigReady(result.meta?.telegramConfigured ?? true)
      setConfigMessage(result.meta?.message ?? null)
    } catch (error) {
      console.error(error)
      toast.error((error as Error).message || 'Ошибка при загрузке каналов')
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    setSettingsLoading(true)
    try {
      const response = await fetch('/api/settings', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось загрузить настройки')
      }
      setSettings(result.data)
    } catch (error) {
      console.error(error)
      toast.error((error as Error).message || 'Ошибка при загрузке настроек')
    } finally {
      setSettingsLoading(false)
    }
  }

  useEffect(() => {
    loadChannels()
    loadSettings()
  }, [])

  const handleAddChannel = async () => {
    if (adding || !newUsername.trim()) return

    setAdding(true)
    try {
      const response = await fetch('/api/telegram-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim() }),
      })
      const result = await response.json()

      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось добавить канал')
      }

      toast.success(result.message || `Канал @${result.data?.username} добавлен`)
      setNewUsername('')
      await loadChannels()
    } catch (error) {
      toast.error((error as Error).message || 'Ошибка при добавлении канала')
    } finally {
      setAdding(false)
    }
  }

  const handleToggleChannel = async (channel: TelegramChannel) => {
    setActionId(channel.id)
    try {
      const response = await fetch(`/api/telegram-channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !channel.isActive }),
      })
      const result = await response.json()
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось обновить канал')
      }
      toast.success(result.message || 'Статус изменён')
      await loadChannels()
    } catch (error) {
      toast.error((error as Error).message || 'Ошибка при обновлении канала')
    } finally {
      setActionId(null)
    }
  }

  const handleDeleteChannel = async (channel: TelegramChannel) => {
    const confirmed = window.confirm(`Удалить канал @${channel.username}?`)
    if (!confirmed) return

    setActionId(channel.id)
    try {
      const response = await fetch(`/api/telegram-channels/${channel.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось удалить канал')
      }
      toast.success(result.message || 'Канал удалён')
      await loadChannels()
    } catch (error) {
      toast.error((error as Error).message || 'Ошибка при удалении канала')
    } finally {
      setActionId(null)
    }
  }

  const handleRefreshChannel = async (channel: TelegramChannel) => {
    setRefreshingId(channel.id)
    try {
      const response = await fetch(`/api/telegram-channels/${channel.id}/refresh`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось обновить канал')
      }
      toast.success(
        result.message ||
          `Получено ${result.data?.fetched ?? 0} сообщений (${result.data?.new ?? 0} новых)`
      )
      await loadChannels()
    } catch (error) {
      toast.error((error as Error).message || 'Ошибка при обновлении канала')
    } finally {
      setRefreshingId(null)
    }
  }

  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => a.username.localeCompare(b.username))
  }, [channels])

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('ru-RU')
  }

  const handleUpdateSetting = (patch: Partial<SettingsPayload>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const handleSaveSettings = async () => {
    if (!settings) return

    setSettingsSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const result = await response.json()
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось сохранить настройки')
      }
      toast.success('Telegram настройки сохранены')
      await Promise.all([loadSettings(), loadChannels()])
    } catch (error) {
      toast.error((error as Error).message || 'Ошибка при сохранении настроек')
    } finally {
      setSettingsSaving(false)
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Telegram каналы</h1>
            <p className="text-muted-foreground mt-2 max-w-3xl">
              Добавляйте публичные каналы Telegram, чтобы автоматически импортировать их публикации в поток
              материалов. Активные каналы обновляются вместе с cron-задачей.
            </p>
          </div>

          {!configReady && (
            <Card className="border-yellow-300 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-950">Telegram не настроен</CardTitle>
                <CardDescription className="text-yellow-900">
                  {configMessage || 'Укажите TELEGRAM API ID, API Hash и Session, чтобы активировать интеграцию.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settingsLoading || !settings ? (
                  <div className="flex items-center gap-2 text-sm text-yellow-900">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка текущих настроек...
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="telegramApiId" className="text-yellow-900">
                          Telegram API ID
                        </Label>
                        <Input
                          id="telegramApiId"
                          type="number"
                          value={settings.telegramApiId}
                          onChange={(event) => handleUpdateSetting({ telegramApiId: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telegramApiHash" className="text-yellow-900">
                          Telegram API Hash
                        </Label>
                        <Input
                          id="telegramApiHash"
                          type="password"
                          value={settings.telegramApiHash}
                          onChange={(event) => handleUpdateSetting({ telegramApiHash: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telegramFetchLimit" className="text-yellow-900">
                          Сообщений за проход
                        </Label>
                        <Input
                          id="telegramFetchLimit"
                          type="number"
                          min={1}
                          max={200}
                          value={settings.telegramFetchLimit}
                          onChange={(event) =>
                            handleUpdateSetting({
                              telegramFetchLimit: Math.max(1, Number(event.target.value) || 1),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telegramSession" className="text-yellow-900">
                        Telegram Session
                      </Label>
                      <Textarea
                        id="telegramSession"
                        rows={4}
                        value={settings.telegramSession}
                        onChange={(event) => handleUpdateSetting({ telegramSession: event.target.value })}
                        placeholder="Вставьте session string, полученный через npm run telegram:auth"
                        className="bg-white"
                      />
                    </div>
                    <Button onClick={handleSaveSettings} disabled={settingsSaving}>
                      {settingsSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Сохранить Telegram настройки
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Добавить канал</CardTitle>
              <CardDescription>Введите username публичного канала (без @)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                placeholder="bbcrussian"
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                className="md:max-w-sm"
                disabled={adding || !configReady}
              />
              <Button onClick={handleAddChannel} disabled={adding || !newUsername.trim() || !configReady}>
                {adding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Добавление...
                  </>
                ) : (
                  'Добавить'
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Список каналов</CardTitle>
              <CardDescription>
                {loading
                  ? 'Загрузка...'
                  : channels.length === 0
                  ? 'Каналы не добавлены'
                  : `${channels.length} канал(ов)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка каналов...
                </div>
              ) : channels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Пока нет ни одного канала. Добавьте первый, чтобы начать импорт.
                </p>
              ) : (
                <div className="space-y-4">
                  {sortedChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">@{channel.username}</span>
                          <Badge variant={channel.isActive ? 'default' : 'secondary'}>
                            {channel.isActive ? 'Активен' : 'Отключен'}
                          </Badge>
                          {channel.subscribersCount ? (
                            <Badge variant="outline">{channel.subscribersCount.toLocaleString()} подписчиков</Badge>
                          ) : null}
                        </div>
                        {channel.title && (
                          <p className="text-sm text-muted-foreground">{channel.title}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Последний импорт: {formatDate(channel.lastParsed)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleChannel(channel)}
                          disabled={actionId === channel.id}
                        >
                          {actionId === channel.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : channel.isActive ? (
                            <PowerOff className="mr-2 h-4 w-4" />
                          ) : (
                            <Power className="mr-2 h-4 w-4" />
                          )}
                          {channel.isActive ? 'Отключить' : 'Включить'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshChannel(channel)}
                          disabled={refreshingId === channel.id}
                        >
                          {refreshingId === channel.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Обновить
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteChannel(channel)}
                          disabled={actionId === channel.id}
                        >
                          {actionId === channel.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Удалить
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

