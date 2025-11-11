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
  analysisPrompt: string
  summaryPrompt: string
}

export default function SettingsPage() {
  const defaultAnalysisPrompt = `Ты - аналитик новостного контента. Проанализируй статью и предоставь структурированный результат.

ЗАДАЧИ:

1. META_DESCRIPTION (150-160 символов):
   - Краткое описание сути статьи для SEO
   - Нейтральный тон, максимально информативно
   - Для поисковых систем и социальных сетей

2. SUMMARY (3-5 предложений):
   - Выдели основные моменты и ключевые идеи
   - Профессиональный аналитический стиль
   - Полностью нейтральное изложение без эмоциональной окраски
   - Простой человеческий язык для комфортного восприятия
   - ВАЖНО: Перефразируй своими словами, НЕ копируй предложения из оригинала
   - SEO уникальность 90%+

3. SENTIMENT (тональность материала):
   - positive (позитивная)
   - neutral (нейтральная)
   - negative (негативная)

4. CONTENT_TYPE (тип контента):
   - purely_factual (новостная заметка, только факты)
   - mostly_factual (преимущественно факты с элементами анализа)
   - balanced (факты и мнения примерно поровну)
   - mostly_opinion (аналитика с мнениями)
   - purely_opinion (авторская колонка, редакционная статья)

ФОРМАТ ВЫВОДА (JSON):
{
  "meta_description": "...",
  "summary": "...",
  "sentiment": "...",
  "content_type": "...",
  "taxonomy": {
    "country": "Название страны или null",
    "city": "Название города или null",
    "themes": ["Список тем"],
    "tags": ["Список тегов"],
    "alliances": ["Список союзов и блоков"]
  }
}

Ответ должен быть на русском языке. Никакого markdown или дополнительного текста - только чистый JSON.`
  const defaultSummaryPrompt =
    'Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).'

  const [settings, setSettings] = useState<Settings>({
    geminiApiKey: '',
    claudeApiKey: '',
    aiProvider: 'gemini',
    analysisPrompt: defaultAnalysisPrompt,
    summaryPrompt: defaultSummaryPrompt,
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
          analysisPrompt: result.data.analysisPrompt || defaultAnalysisPrompt,
          summaryPrompt: result.data.summaryPrompt || defaultSummaryPrompt,
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
              )}

              {settings.aiProvider === 'claude' && (
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
                  </p>
                </div>
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
                  Этот промпт используется для генерации meta_description, summary, sentiment и content_type
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
        </div>
      </div>
    </>
  )
}

