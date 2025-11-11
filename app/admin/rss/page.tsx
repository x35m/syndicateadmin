'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { FeedManager } from '@/components/feed-manager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface SyncStats {
  lastFetch: string | null
}

export default function RssFeedsPage() {
  const [stats, setStats] = useState<SyncStats>({ lastFetch: null })
  const [syncing, setSyncing] = useState(false)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const result = await response.json()
      if (result.success) {
        setStats({ lastFetch: result.data?.lastFetch ?? null })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync', { method: 'POST' })
      const result = await response.json()

      if (result.success) {
        const sync = result.data
        toast.success(
          `Синхронизация завершена.\nЗагружено: ${sync.fetched}, Новых: ${sync.new}, Обновлено: ${sync.updated}`
        )
        await fetchStats()
      } else {
        toast.error(result.error || 'Не удалось выполнить синхронизацию')
      }
    } catch (error) {
      console.error('Error syncing feeds:', error)
      toast.error('Ошибка при синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Управление RSS фидами</h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Добавляйте и обновляйте RSS источники. После добавления материалы подтягиваются автоматически, также можно инициировать принудительный импорт.
              </p>
            </div>
            <Card className="w-full max-w-sm">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Синхронизация</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 py-3">
                <div className="text-sm text-muted-foreground">
                  Последняя синхронизация: {stats.lastFetch ? new Date(stats.lastFetch).toLocaleString('ru-RU') : 'Никогда'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="justify-start"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Синхронизация...' : 'Синхронизировать все фиды'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <FeedManager lastSync={stats.lastFetch} />
        </div>
      </div>
    </>
  )
}

