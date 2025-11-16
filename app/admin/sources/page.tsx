'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function SourcesPage() {
  // RSS
  const [rssUrl, setRssUrl] = useState('')
  const [rssTitle, setRssTitle] = useState('')
  const [addingRss, setAddingRss] = useState(false)

  // Telegram
  const [tgUsername, setTgUsername] = useState('')
  const [addingTg, setAddingTg] = useState(false)

  const addRss = async () => {
    if (!rssUrl.trim()) {
      toast.warning('Введите URL RSS ленты')
      return
    }
    setAddingRss(true)
    try {
      const response = await fetch('/api/local-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rssUrl.trim(), title: rssTitle.trim() || undefined }),
      })
      const result = await response.json()
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось добавить RSS ленту')
      }
      toast.success('RSS лента добавлена')
      setRssUrl('')
      setRssTitle('')
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при добавлении RSS')
    } finally {
      setAddingRss(false)
    }
  }

  const addTelegram = async () => {
    if (!tgUsername.trim()) {
      toast.warning('Введите @username канала')
      return
    }
    setAddingTg(true)
    try {
      const response = await fetch('/api/telegram-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: tgUsername.trim().replace(/^@/, '') }),
      })
      const result = await response.json()
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось добавить канал')
      }
      toast.success('Канал добавлен и синхронизируется')
      setTgUsername('')
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при добавлении канала')
    } finally {
      setAddingTg(false)
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Источники</h1>
            <p className="text-muted-foreground mt-2">
              Быстрое добавление RSS лент и Telegram каналов. Полный список и управление — в разделах «RSS фиды» и «Telegram».
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Добавить RSS ленту</CardTitle>
                <CardDescription>Укажите адрес RSS и (опционально) заголовок</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL RSS</label>
                  <Input
                    placeholder="https://example.com/rss.xml"
                    value={rssUrl}
                    onChange={(e) => setRssUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Название (опционально)</label>
                  <Input
                    placeholder="Название источника"
                    value={rssTitle}
                    onChange={(e) => setRssTitle(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addRss} disabled={addingRss}>
                    {addingRss ? 'Добавление...' : 'Добавить'}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/admin/rss">Перейти к списку</a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Добавить Telegram канал</CardTitle>
                <CardDescription>Введите публичный @username канала</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">@username</label>
                  <Input
                    placeholder="@channel_username"
                    value={tgUsername}
                    onChange={(e) => setTgUsername(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addTelegram} disabled={addingTg}>
                    {addingTg ? 'Добавление...' : 'Добавить'}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/admin/telegram">Перейти к списку</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

