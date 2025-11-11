'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

interface Settings {
  geminiApiKey: string
  summaryPrompt: string
  taxonomySystemPrompt: string
  taxonomyFormatPrompt: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    geminiApiKey: '',
    summaryPrompt: 'Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).',
    taxonomySystemPrompt: 'Ты — редактор аналитического портала. Определи страну, город, темы и теги статьи так, чтобы они помогали редакции быстро рубрицировать материалы.',
    taxonomyFormatPrompt: 'Верни ответ строго в формате JSON:\n{\n  "summary": "краткое резюме на русском",\n  "taxonomy": {\n    "country": "Название страны или null",\n    "city": "Название города или null",\n    "themes": ["Список тем"],\n    "tags": ["Список тегов"]\n  }\n}\nНе добавляй пояснений. Если не удалось определить значение, используй null или пустой массив.',
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
        setSettings(result.data)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings.geminiApiKey.trim()) {
      toast.warning('Введите API ключ Gemini')
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
              Настройте интеграцию с Gemini AI для генерации саммари статей
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gemini AI</CardTitle>
              <CardDescription>
                API ключ можно получить на{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  aistudio.google.com
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API ключ Gemini</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="AIzaSy..."
                  value={settings.geminiApiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, geminiApiKey: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">Промпт для генерации саммари</Label>
                <Textarea
                  id="prompt"
                  rows={6}
                  placeholder="Введите промпт для нейросети..."
                  value={settings.summaryPrompt}
                  onChange={(e) =>
                    setSettings({ ...settings, summaryPrompt: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Текст статьи будет автоматически добавлен после промпта
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxonomySystemPrompt">Системный промпт таксономии</Label>
                <Textarea
                  id="taxonomySystemPrompt"
                  rows={6}
                  placeholder="Опиши правила подбора страны, города, тем и тегов..."
                  value={settings.taxonomySystemPrompt}
                  onChange={(e) =>
                    setSettings({ ...settings, taxonomySystemPrompt: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Используется как системные правила для подбора страны, города, тем и тегов
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxonomyFormatPrompt">Формат ответа таксономии</Label>
                <Textarea
                  id="taxonomyFormatPrompt"
                  rows={6}
                  placeholder='Определи формат JSON-ответа, например {"summary": "...", "taxonomy": {...}}'
                  value={settings.taxonomyFormatPrompt}
                  onChange={(e) =>
                    setSettings({ ...settings, taxonomyFormatPrompt: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Тут можно описать желаемую JSON-структуру ответа для автозаполнения таксономии
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

