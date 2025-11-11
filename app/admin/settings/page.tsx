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
}

export default function SettingsPage() {
  const defaultSummaryPrompt =
    'Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).'

  const [settings, setSettings] = useState<Settings>({
    geminiApiKey: '',
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

