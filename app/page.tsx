'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Database, CheckCircle2, Archive, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { FeedManager } from '@/components/feed-manager'

interface Material {
  id: string
  title: string
  content: string
  fullContent?: string
  thumbnail?: string
  author?: string
  createdAt: string
  fetchedAt: string
  source: string
  status: 'new' | 'processed' | 'archived'
}

interface Stats {
  total: number
  new: number
  processed: number
  archived: number
  lastFetch: string | null
}

export default function Home() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const fetchMaterials = async (status?: string | null) => {
    try {
      const url = status 
        ? `/api/materials?status=${status}` 
        : '/api/materials?limit=50'
      
      const response = await fetch(url)
      const result = await response.json()
      
      if (result.success) {
        setMaterials(result.data)
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    }
  }

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
      console.log('🔄 Starting sync...')
      const response = await fetch('/api/sync', { method: 'POST' })
      const result = await response.json()
      
      console.log('📊 Sync result:', result)
      
      if (result.success) {
        await fetchMaterials(filter)
        await fetchStats()
        
        const stats = result.data
        console.log('✅ Sync stats:', {
          new: stats.new,
          updated: stats.updated,
          fetched: stats.fetched,
          errors: stats.errors
        })
        
        alert(
          `✅ Умная синхронизация завершена!\n\n` +
          `📥 Новых материалов: ${stats.new || 0}\n` +
          `🔄 Обновлено: ${stats.updated || 0}\n` +
          `📊 Всего обработано: ${stats.fetched || 0}\n` +
          `${stats.errors > 0 ? `❌ Ошибок: ${stats.errors}\n` : ''}`
        )
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

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })

      const result = await response.json()
      
      if (result.success) {
        await fetchMaterials(filter)
        await fetchStats()
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleFilterChange = async (status: string | null) => {
    setFilter(status)
    setLoading(true)
    await fetchMaterials(status)
    setLoading(false)
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchMaterials(filter),
        fetchStats()
      ])
      setLoading(false)
    }

    loadData()

    // Автообновление каждые 30 секунд
    const interval = setInterval(() => {
      fetchStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default">Новый</Badge>
      case 'processed':
        return <Badge variant="secondary">Обработан</Badge>
      case 'archived':
        return <Badge variant="outline">Архив</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU')
  }

  const openMaterialDialog = (material: Material) => {
    setSelectedMaterial(material)
    setIsDialogOpen(true)
  }

  const getSanitizedHtml = (html: string) => {
    // Простая санитизация: удаляем потенциально опасные теги и атрибуты
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Удаляем скрипты
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Удаляем iframe
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Удаляем event handlers (onclick, onload, etc)
      .replace(/javascript:/gi, '') // Удаляем javascript: в ссылках
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Material Admin</h1>
            <p className="text-muted-foreground mt-2">
              Управление материалами из RSS фидов
            </p>
          </div>
          <Button 
            onClick={handleSync} 
            disabled={syncing}
            size="lg"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать'}
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Всего материалов</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-accent" onClick={() => handleFilterChange('new')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Новые</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.new}</div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-accent" onClick={() => handleFilterChange('processed')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Обработано</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.processed}</div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-accent" onClick={() => handleFilterChange('archived')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Архив</CardTitle>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.archived}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Feed Manager */}
        <FeedManager />

        {/* Filters */}
        <div className="flex gap-2">
          <Button 
            variant={filter === null ? 'default' : 'outline'}
            onClick={() => handleFilterChange(null)}
          >
            Все
          </Button>
          <Button 
            variant={filter === 'new' ? 'default' : 'outline'}
            onClick={() => handleFilterChange('new')}
          >
            Новые
          </Button>
          <Button 
            variant={filter === 'processed' ? 'default' : 'outline'}
            onClick={() => handleFilterChange('processed')}
          >
            Обработанные
          </Button>
          <Button 
            variant={filter === 'archived' ? 'default' : 'outline'}
            onClick={() => handleFilterChange('archived')}
          >
            Архив
          </Button>
        </div>

        {/* Materials Table */}
        <Card>
          <CardHeader>
            <CardTitle>Материалы</CardTitle>
            <CardDescription>
              {loading ? 'Загрузка...' : `Показано материалов: ${materials.length}`}
              {stats?.lastFetch && (
                <span className="ml-4">
                  Последняя загрузка: {formatDate(stats.lastFetch)}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка данных...</div>
            ) : materials.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Нет материалов. Нажмите "Синхронизировать" для загрузки.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Обложка</TableHead>
                    <TableHead>Заголовок</TableHead>
                    <TableHead>Автор</TableHead>
                    <TableHead>Источник</TableHead>
                    <TableHead>Дата создания</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((material) => (
                    <TableRow key={material.id} className="cursor-pointer hover:bg-accent/50" onClick={() => openMaterialDialog(material)}>
                      <TableCell>
                        {material.thumbnail ? (
                          <img 
                            src={material.thumbnail} 
                            alt={material.title}
                            className="w-16 h-16 object-cover rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                            Нет фото
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-md">
                        <div className="truncate">{material.title}</div>
                      </TableCell>
                      <TableCell>{material.author || '—'}</TableCell>
                      <TableCell>
                        <div className="truncate max-w-[200px]" title={material.source}>
                          {material.source || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(material.createdAt)}</TableCell>
                      <TableCell>{getStatusBadge(material.status)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {material.status === 'new' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(material.id, 'processed')}
                            >
                              Обработать
                            </Button>
                          )}
                          {material.status === 'processed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(material.id, 'archived')}
                            >
                              В архив
                            </Button>
                          )}
                          {material.status === 'archived' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(material.id, 'new')}
                            >
                              Восстановить
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Автоматическая синхронизация: каждые 5 минут</p>
            <p>• Статистика обновляется: каждые 30 секунд</p>
            <p>• Нажмите на карточки статистики для фильтрации</p>
            <p>• Кликните на материал чтобы открыть полную версию</p>
          </CardContent>
        </Card>
      </div>

      {/* Material Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedMaterial && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl pr-8">{selectedMaterial.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-4 mt-2">
                  <span>{selectedMaterial.author || 'Автор неизвестен'}</span>
                  <span>•</span>
                  <span>{formatDate(selectedMaterial.createdAt)}</span>
                  <span>•</span>
                  <span>{getStatusBadge(selectedMaterial.status)}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4">
                {selectedMaterial.source && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <ExternalLink className="h-4 w-4" />
                    <span>Источник: {selectedMaterial.source}</span>
                  </div>
                )}

                {selectedMaterial.fullContent ? (
                  <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: getSanitizedHtml(selectedMaterial.fullContent) }}
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                    }}
                  />
                ) : (
                  <div className="text-muted-foreground">
                    {selectedMaterial.content}
                  </div>
                )}

                <div className="mt-6 flex gap-2 pt-4 border-t">
                  {selectedMaterial.status === 'new' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleStatusChange(selectedMaterial.id, 'processed')
                        setIsDialogOpen(false)
                      }}
                    >
                      Обработать
                    </Button>
                  )}
                  {selectedMaterial.status === 'processed' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleStatusChange(selectedMaterial.id, 'archived')
                        setIsDialogOpen(false)
                      }}
                    >
                      В архив
                    </Button>
                  )}
                  {selectedMaterial.status === 'archived' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleStatusChange(selectedMaterial.id, 'new')
                        setIsDialogOpen(false)
                      }}
                    >
                      Восстановить
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
