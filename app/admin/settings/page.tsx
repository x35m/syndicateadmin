'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Save, ChevronDown } from 'lucide-react'

interface Settings {
  geminiApiKey: string
  claudeApiKey: string
  aiProvider: 'gemini' | 'claude'
  geminiModel: string
  claudeModel: string
  analysisPrompt: string
  telegramApiId: string
  telegramApiHash: string
  telegramSession: string
  telegramFetchLimit: number
}

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (быстрая, дешевая)' },
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (мощная)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
]

const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (2025)' },
  { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet (баланс)' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (самый дешевый)' },
]

export default function SettingsPage() {
  const defaultAnalysisPrompt = `Ты - аналитик новостного контента. Проанализируй статьи и оцени характеристики материала.

ЗАДАЧИ:

1. SENTIMENT (тональность материала):
   - positive (позитивная)
   - neutral (нейтральная)
   - negative (негативная)

2. CONTENT_TYPE (тип контента):
   - purely_factual (новостная заметка, только факты)
   - mostly_factual (преимущественно факты с элементами анализа)
   - balanced (факты и мнения примерно поровну)
   - mostly_opinion (аналитика с мнениями)
   - purely_opinion (авторская колонка, редакционная статья)

3. TAXONOMY (классификация):
   - Определи подходящие категории, а также страны и города, связанные с материалом

ПРИНЦИПЫ:
- Пиши напрямую, не ссылайся на статью («В материале говорится…»)
- Максимально информативно и нейтрально
- Избегай клише и оценочных суждений`
  const [settings, setSettings] = useState<Settings>({
    geminiApiKey: '',
    claudeApiKey: '',
    aiProvider: 'gemini',
    geminiModel: 'gemini-2.5-flash',
    claudeModel: 'claude-sonnet-4-20250514',
    analysisPrompt: defaultAnalysisPrompt,
    telegramApiId: '',
    telegramApiHash: '',
    telegramSession: '',
    telegramFetchLimit: 50,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      const result = await response.json()
      
      if (result.success && result.data) {
        setSettings({
          geminiApiKey: result.data.geminiApiKey || '',
          claudeApiKey: result.data.claudeApiKey || '',
          aiProvider: result.data.aiProvider || 'gemini',
          geminiModel: result.data.geminiModel || 'gemini-2.5-flash',
          claudeModel: result.data.claudeModel || 'claude-sonnet-4-20250514',
          analysisPrompt: result.data.analysisPrompt || defaultAnalysisPrompt,
          telegramApiId: result.data.telegramApiId || '',
          telegramApiHash: result.data.telegramApiHash || '',
          telegramSession: result.data.telegramSession || '',
          telegramFetchLimit: Number(result.data.telegramFetchLimit) || 50,
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const apiKey = settings.aiProvider === 'claude' ? settings.claudeApiKey : settings.geminiApiKey
    if (!apiKey.trim()) {
      toast.warning(`Введите API ключ ${settings.aiProvider === 'claude' ? 'Claude' : 'Gemini'}`)
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success('Настройки успешно сохранены')
      } else {
        toast.error(`Ошибка: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Ошибка при сохранении настроек')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <AdminHeader />
        <div className="min-h-screen bg-background p-8">
          <div className="container max-w-4xl">
            <div className="text-center py-8">Загрузка...</div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Настройки</h1>
            <p className="text-muted-foreground mt-2">
              Настройте интеграцию с AI для генерации анализа статей
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>AI Провайдер</CardTitle>
              <CardDescription>
                Выберите провайдера AI для анализа статей
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aiProvider">Провайдер AI</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {settings.aiProvider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'}
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => setSettings({ ...settings, aiProvider: 'gemini' })}
                    >
                      Google Gemini
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSettings({ ...settings, aiProvider: 'claude' })}
                    >
                      Anthropic Claude
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {settings.aiProvider === 'gemini' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="geminiApiKey">API ключ Gemini</Label>
                <Input
                      id="geminiApiKey"
                  type="password"
                  placeholder="AIzaSy..."
                  value={settings.geminiApiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, geminiApiKey: e.target.value })
                  }
                />
                    <p className="text-xs text-muted-foreground">
                      API ключ можно получить на{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        aistudio.google.com
                      </a>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="geminiModel">Модель Gemini</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {GEMINI_MODELS.find(m => m.value === settings.geminiModel)?.label || settings.geminiModel}
                          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {GEMINI_MODELS.map((model) => (
                          <DropdownMenuItem
                            key={model.value}
                            onClick={() => setSettings({ ...settings, geminiModel: model.value })}
                          >
                            {model.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              )}

              {settings.aiProvider === 'claude' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="claudeApiKey">API ключ Claude</Label>
                    <Input
                      id="claudeApiKey"
                      type="password"
                      placeholder="sk-ant-..."
                      value={settings.claudeApiKey}
                      onChange={(e) =>
                        setSettings({ ...settings, claudeApiKey: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      API ключ можно получить на{' '}
                      <a
                        href="https://console.anthropic.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        console.anthropic.com
                      </a>
                      . Не забудьте пополнить баланс минимум на $5-10 для старта.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claudeModel">Модель Claude</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {CLAUDE_MODELS.find(m => m.value === settings.claudeModel)?.label || settings.claudeModel}
                          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {CLAUDE_MODELS.map((model) => (
                          <DropdownMenuItem
                            key={model.value}
                            onClick={() => setSettings({ ...settings, claudeModel: model.value })}
                          >
                            {model.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <p className="text-xs text-muted-foreground">
                      Haiku - ~$0.35-0.40/день для 400 статей. Sonnet дороже, но качественнее.
                    </p>
              </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="analysisPrompt">Промпт для анализа статей</Label>
                <Textarea
                  id="analysisPrompt"
                  rows={20}
                  placeholder="Введите промпт для нейросети..."
                  value={settings.analysisPrompt}
                  onChange={(e) =>
                    setSettings({ ...settings, analysisPrompt: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Этот промпт используется для оценки sentiment, content_type и подсказок по таксономии
                </p>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>Сохранение...</>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Сохранить настройки
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Интеграция Telegram</CardTitle>
              <CardDescription>
                Настройте ключи Telegram API и session string, чтобы импортировать сообщения публичных каналов.
                Используйте скрипт <code>npm run telegram:auth</code> для генерации session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telegramApiId">Telegram API ID</Label>
                  <Input
                    id="telegramApiId"
                    type="number"
                    placeholder="1234567"
                    value={settings.telegramApiId}
                    onChange={(e) => setSettings({ ...settings, telegramApiId: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegramApiHash">Telegram API Hash</Label>
                  <Input
                    id="telegramApiHash"
                    type="password"
                    placeholder="abcd1234..."
                    value={settings.telegramApiHash}
                    onChange={(e) => setSettings({ ...settings, telegramApiHash: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegramSession">Telegram Session</Label>
                <Textarea
                  id="telegramSession"
                  rows={5}
                  placeholder="Введите session string, полученный через telegram-auth"
                  value={settings.telegramSession}
                  onChange={(e) => setSettings({ ...settings, telegramSession: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Session string используется для авторизации. Храните его в секрете и не публикуйте в Git.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegramFetchLimit">Сообщений за один проход</Label>
                <Input
                  id="telegramFetchLimit"
                  type="number"
                  min={1}
                  max={200}
                  value={settings.telegramFetchLimit}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      telegramFetchLimit: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>Сохранение...</>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Сохранить Telegram настройки
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

