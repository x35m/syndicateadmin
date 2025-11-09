'use client'

import { useEffect, useState } from 'react'
import { Database, CheckCircle2, Archive, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedManager } from '@/components/feed-manager'
import { Header } from '@/components/header'

interface Stats {
  total: number
  new: number
  processed: number
  archived: number
  lastFetch: string | null
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [syncing, setSyncing] = useState(false)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
      })

      const result = await response.json()

      if (result.success) {
        const stats = result.data
        alert(
          `✅ Синхронизация завершена!\n\n` +
          `📥 Новых материалов: ${stats.new || 0}\n` +
          `🔄 Обновлено: ${stats.updated || 0}\n` +
          `📊 Всего обработано: ${stats.fetched || 0}\n` +
          `${stats.errors > 0 ? `❌ Ошибок: ${stats.errors}\n` : ''}`
        )
        await fetchStats()
      } else {
        console.error('❌ Sync failed:', result.error)
        alert(`Ошибка синхронизации: ${result.error}`)
      }
    } catch (error) {
      console.error('Error syncing:', error)
      alert('Ошибка при синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchStats()

    // Автообновление статистики каждые 30 секунд
    const interval = setInterval(() => {
      fetchStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Никогда'
    return new Date(dateString).toLocaleString('ru-RU')
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-8">

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Всего материалов
                </CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Последняя синхронизация: {formatDate(stats.lastFetch)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Новые
                </CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.new}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Требуют обработки
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Опубликованные
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.processed}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Опубликованы
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  В архиве
                </CardTitle>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.archived}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Архивные материалы
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Feed Manager */}
        <FeedManager />
        </div>
      </div>
    </>
  )
}
