'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { toast } from 'sonner'

export default function TelegramSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [telegramApiId, setTelegramApiId] = useState('')
  const [telegramApiHash, setTelegramApiHash] = useState('')
  const [telegramSession, setTelegramSession] = useState('')
  const [telegramFetchLimit, setTelegramFetchLimit] = useState<number>(50)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const resp = await fetch('/api/settings')
        const result = await resp.json()
        if (resp.ok && result.success) {
          setTelegramApiId(result.data.telegramApiId || '')
          setTelegramApiHash(result.data.telegramApiHash || '')
          setTelegramSession(result.data.telegramSession || '')
          setTelegramFetchLimit(Number(result.data.telegramFetchLimit) || 50)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramApiId,
          telegramApiHash,
          telegramSession,
          telegramFetchLimit,
        }),
      })
      const result = await response.json()
      if (response.ok && result.success) {
        toast.success('Telegram настройки сохранены')
      } else {
        toast.error(result.error || 'Не удалось сохранить')
      }
    } catch {
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Telegram настройки</h1>
            <p className="text-muted-foreground mt-2">
              Настройте ключи Telegram API и session string для импорта каналов
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Интеграция Telegram</CardTitle>
              <CardDescription>
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
                    value={telegramApiId}
                    onChange={(e) => setTelegramApiId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegramApiHash">Telegram API Hash</Label>
                  <Input
                    id="telegramApiHash"
                    type="text"
                    placeholder="abcd1234..."
                    value={telegramApiHash}
                    onChange={(e) => setTelegramApiHash(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegramSession">Telegram Session</Label>
                <Input
                  id="telegramSession"
                  type="text"
                  placeholder="1AAgb...."
                  value={telegramSession}
                  onChange={(e) => setTelegramSession(e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telegramFetchLimit">Сообщений за один проход</Label>
                  <Input
                    id="telegramFetchLimit"
                    type="number"
                    min={1}
                    max={500}
                    value={telegramFetchLimit}
                    onChange={(e) => setTelegramFetchLimit(Number(e.target.value))}
                  />
                </div>
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
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const resp = await fetch('/api/telegram/reset', { method: 'POST' })
                      const result = await resp.json()
                      if (resp.ok && result.success) {
                        toast.success('Клиент Telegram перезапущен')
                      } else {
                        toast.error(result.error || 'Не удалось перезапустить клиент')
                      }
                    } catch {
                      toast.error('Ошибка при перезапуске клиента')
                    }
                  }}
                >
                  Перезапустить клиент Telegram
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

