'use client'

import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface Feed {
  id: string
  name: string
  feedName?: string
  url: string
  feedUrl?: string
  unread?: number
}

export function FeedManager() {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)

  const fetchFeeds = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/feeds')
      const result = await response.json()
      
      if (result.success) {
        setFeeds(result.data)
      }
    } catch (error) {
      console.error('Error fetching feeds:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeeds()
  }, [])

  const handleAddFeed = async () => {
    if (!newFeedUrl.trim()) {
      alert('Пожалуйста, введите URL фида')
      return
    }

    setAdding(true)
    try {
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl: newFeedUrl }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('✅ Фид успешно добавлен!')
        setNewFeedUrl('')
        setIsAddDialogOpen(false)
        
        // Обновляем список фидов
        await fetchFeeds()
        
        // Автоматически импортируем материалы из нового фида
        if (result.data.feedId) {
          handleImportFeed(result.data.feedId)
        }
      } else {
        alert(`❌ Ошибка: ${result.error}`)
      }
    } catch (error) {
      console.error('Error adding feed:', error)
      alert('❌ Ошибка при добавлении фида')
    } finally {
      setAdding(false)
    }
  }

  const handleImportFeed = async (feedId: string) => {
    setImporting(feedId)
    try {
      const response = await fetch('/api/feeds/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId, limit: 50 }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        const { fetched, new: newCount, updated } = result.data
        alert(
          `✅ Импорт завершен!\n\n` +
          `📥 Загружено: ${fetched}\n` +
          `🆕 Новых: ${newCount}\n` +
          `🔄 Обновлено: ${updated}`
        )
      } else {
        alert(`❌ Ошибка: ${result.error}`)
      }
    } catch (error) {
      console.error('Error importing feed:', error)
      alert('❌ Ошибка при импорте материалов')
    } finally {
      setImporting(null)
    }
  }

  const handleDeleteFeed = async (feedId: string, feedName: string) => {
    if (!confirm(`Вы уверены, что хотите отписаться от фида "${feedName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/feeds?id=${feedId}`, {
        method: 'DELETE',
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('✅ Фид удален')
        await fetchFeeds()
      } else {
        alert(`❌ Ошибка: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting feed:', error)
      alert('❌ Ошибка при удалении фида')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Управление фидами</CardTitle>
            <CardDescription>
              Добавляйте новые RSS фиды и импортируйте контент
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFeeds}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить фид
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Загрузка фидов...
          </div>
        ) : feeds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Фиды не найдены. Добавьте первый фид!
          </div>
        ) : (
          <div className="space-y-2">
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">
                      {feed.name || feed.feedName || 'Без названия'}
                    </h4>
                    {feed.unread !== undefined && feed.unread > 0 && (
                      <Badge variant="secondary">{feed.unread} непрочитанных</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {feed.url || feed.feedUrl || 'URL не указан'}
                  </p>
                </div>
                <div className="flex gap-1 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleImportFeed(feed.id)}
                    disabled={importing === feed.id}
                  >
                    {importing === feed.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteFeed(feed.id, feed.name || feed.feedName || 'фида')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Диалог добавления нового фида */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить новый RSS фид</DialogTitle>
            <DialogDescription>
              Введите URL RSS фида. После добавления материалы будут автоматически импортированы.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feed-url">URL фида</Label>
              <Input
                id="feed-url"
                placeholder="https://example.com/feed.xml"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !adding) {
                    handleAddFeed()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                setNewFeedUrl('')
              }}
              disabled={adding}
            >
              Отмена
            </Button>
            <Button onClick={handleAddFeed} disabled={adding}>
              {adding ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Добавление...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

