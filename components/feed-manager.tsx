'use client'

import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Feed {
  id: string
  name?: string
  title?: string | null
  feedName?: string
  url: string
  feedUrl?: string
  unread?: number
  status: 'active' | 'inactive' | 'deleted'
  lastFetched?: string | null
}

type BulkFeedAction = 'update' | 'delete' | null

interface FeedManagerProps {
  lastSync: string | null
}

export function FeedManager({ lastSync }: FeedManagerProps) {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [togglingFeedId, setTogglingFeedId] = useState<string | null>(null)
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [selectedFeedIds, setSelectedFeedIds] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<BulkFeedAction>(null)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')

  const fetchFeeds = async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/local-feeds')
      const result = await response.json()
      
      if (result.success) {
        const normalizedFeeds: Feed[] = (result.data ?? []).map((feed: any) => ({
          ...feed,
          id: String(feed.id),
          status: feed.status ?? 'active',
          lastFetched: feed.lastFetched ?? feed.last_fetched ?? null,
        }))
        setFeeds(normalizedFeeds)
      }
    } catch (error) {
      console.error('Error fetching feeds:', error)
      toast.error('Не удалось загрузить список фидов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeeds()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const handleAddFeed = async () => {
    if (!newFeedUrl.trim()) {
      toast.warning('Пожалуйста, введите URL фида')
      return
    }

    setAdding(true)
    try {
      console.log('🔄 Adding local RSS feed:', newFeedUrl)
      const response = await fetch('/api/local-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl: newFeedUrl }),
      })
      
      const result = await response.json()
      console.log('📊 Add feed result:', result)
      
      if (result.success) {
        const stats = result.data.stats
        toast.success(
          `Фид успешно добавлен! Загружено: ${stats.fetched}, Новых: ${stats.new}, Обновлено: ${stats.updated}`
        )
        setNewFeedUrl('')
        setIsAddDialogOpen(false)
        
        await fetchFeeds()
      } else {
        const errorMsg = result.error || 'Неизвестная ошибка'
        console.error('❌ Add feed failed:', errorMsg)
        toast.error(`Ошибка: ${errorMsg}`)
      }
    } catch (error) {
      console.error('Error adding feed:', error)
      toast.error('Ошибка при добавлении фида')
    } finally {
      setAdding(false)
    }
  }

  const handleBulkAction = (action: BulkFeedAction) => {
    if (selectedFeedIds.size === 0) {
      toast.warning('Выберите фиды для обработки')
      return
    }
    setPendingAction(action)
  }

  const executeBulkAction = async () => {
    if (!pendingAction) return

    const action = pendingAction
    const idsArray = Array.from(selectedFeedIds)

    setBulkActionLoading(true)
    try {
      if (action === 'update') {
        for (const id of idsArray) {
          await handleImportFeed(id, true)
        }
        toast.success(`Успешно обновлено ${idsArray.length} фид(ов)`)
      } else if (action === 'delete') {
        for (const id of idsArray) {
          await fetch(`/api/local-feeds?id=${id}`, {
            method: 'DELETE',
          })
        }
        toast.success(`Успешно удалено ${idsArray.length} фид(ов)`)
        await fetchFeeds()
      }

      setSelectedFeedIds(new Set())
    } catch (error) {
      console.error('Error performing bulk action:', error)
      toast.error('Ошибка при выполнении действия')
    } finally {
      setBulkActionLoading(false)
      setPendingAction(null)
    }
  }

  const handleImportFeed = async (feedId: string, silent = false) => {
    setImporting(feedId)
    try {
      const response = await fetch('/api/local-feeds/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        const { fetched, new: newCount, updated } = result.data
        if (!silent) {
          toast.success(
            `Импорт завершен! Загружено: ${fetched}, Новых: ${newCount}, Обновлено: ${updated}`
          )
        }
        await fetchFeeds()
      } else {
        if (!silent) {
          toast.error(`Ошибка: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('Error importing feed:', error)
      if (!silent) {
        toast.error('Ошибка при импорте материалов')
      }
    } finally {
      setImporting(null)
    }
  }

  const handleToggleFeedStatus = async (feed: Feed) => {
    const nextStatus = feed.status === 'active' ? 'inactive' : 'active'
    setTogglingFeedId(feed.id)
    try {
      const response = await fetch('/api/local-feeds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: feed.id, status: nextStatus }),
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Не удалось обновить статус фида')
      }

      setFeeds((prev) =>
        prev.map((item) =>
          item.id === feed.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      )

      toast.success(
        nextStatus === 'active'
          ? 'Фид активирован и будет участвовать в автоматическом импорте'
          : 'Фид деактивирован и не будет участвовать в автоматическом импорте'
      )
    } catch (error) {
      console.error('Error toggling feed status:', error)
      toast.error('Не удалось обновить статус фида')
    } finally {
      setTogglingFeedId(null)
    }
  }

  const startEditing = (feed: Feed) => {
    setEditingFeedId(feed.id)
    setEditingTitle(feed.title || feed.name || feed.feedName || '')
  }

  const cancelEditing = () => {
    setEditingFeedId(null)
    setEditingTitle('')
  }

  const saveTitle = async (feedId: string) => {
    if (!editingTitle.trim()) {
      toast.warning('Название не может быть пустым')
      return
    }

    try {
      const response = await fetch('/api/local-feeds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: feedId, 
          title: editingTitle.trim() 
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success('Название обновлено')
        await fetchFeeds()
        setEditingFeedId(null)
        setEditingTitle('')
      } else {
        toast.error(`Ошибка: ${result.error}`)
      }
    } catch (error) {
      console.error('Error updating feed title:', error)
      toast.error('Ошибка при обновлении названия')
    }
  }

  const filteredFeeds = feeds.filter((feed) => {
    if (!search.trim()) return true
    const term = search.trim().toLowerCase()
    return (
      (feed.title && feed.title.toLowerCase().includes(term)) ||
      (feed.name && feed.name.toLowerCase().includes(term)) ||
      (feed.feedName && feed.feedName.toLowerCase().includes(term)) ||
      (feed.url && feed.url.toLowerCase().includes(term))
    )
  })
  const totalPages = Math.ceil(filteredFeeds.length / pageSize) || 1
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedFeeds = filteredFeeds.slice(startIndex, endIndex)

  const goToPage = (page: number, total: number) => {
    setCurrentPage(Math.max(1, Math.min(page, total)))
  }

  const changePageSize = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const toggleSelectAll = () => {
    if (selectedFeedIds.size === paginatedFeeds.length && paginatedFeeds.length > 0) {
      // Deselect all on current page
      const newSelected = new Set(selectedFeedIds)
      paginatedFeeds.forEach((f: Feed) => newSelected.delete(f.id))
      setSelectedFeedIds(newSelected)
    } else {
      // Select all on current page
      const newSelected = new Set(selectedFeedIds)
      paginatedFeeds.forEach((f: Feed) => newSelected.add(f.id))
      setSelectedFeedIds(newSelected)
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedFeedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedFeedIds(newSelected)
  }

  const getActionDialogContent = () => {
    const count = selectedFeedIds.size
    switch (pendingAction) {
      case 'update':
        return {
          title: 'Обновить фиды',
          description: `Вы уверены, что хотите обновить ${count} фид(ов)? Это может занять некоторое время.`,
          actionText: 'Обновить',
          variant: 'default' as const,
        }
      case 'delete':
        return {
          title: 'Удалить фиды',
          description: `Вы уверены, что хотите удалить ${count} фид(ов)? Материалы из этих фидов останутся в базе.`,
          actionText: 'Удалить',
          variant: 'destructive' as const,
        }
      default:
        return null
    }
  }

  const dialogContent = getActionDialogContent()

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Никогда'
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} ${hours}:${minutes}`
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Управление RSS фидами</CardTitle>
              <CardDescription className="mt-1">
                Последняя синхронизация: {formatDate(lastSync)}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Поиск по названию или URL..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full sm:w-64"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSearch('')
                    setCurrentPage(1)
                  }}
                  title="Сбросить фильтр"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
          {/* Pagination Controls - Top */}
          {!loading && filteredFeeds.length > 0 && (
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Показано {startIndex + 1}-{Math.min(endIndex, filteredFeeds.length)} из {filteredFeeds.length}
                  </span>
                </div>

              <div className="flex items-center gap-4">
                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">На странице:</span>
                  <div className="flex gap-1">
                    {[25, 50, 100, 200].map((size) => (
                      <Button
                        key={size}
                        variant={pageSize === size ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => changePageSize(size)}
                        className="h-8 w-12"
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Page Navigation */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(1, totalPages)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                    title="Первая страница"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1, totalPages)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                    title="Предыдущая страница"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1 px-2">
                    <span className="text-sm font-medium">{currentPage}</span>
                    <span className="text-sm text-muted-foreground">из</span>
                    <span className="text-sm font-medium">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1, totalPages)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                    title="Следующая страница"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(totalPages, totalPages)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                    title="Последняя страница"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : filteredFeeds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Фиды не найдены. Попробуйте изменить поиск или добавьте новый фид.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={paginatedFeeds.length > 0 && paginatedFeeds.every((f: Feed) => selectedFeedIds.has(f.id))}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Название источника</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-40 text-center">Статус</TableHead>
                  <TableHead className="w-[120px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedFeeds.map((feed) => (
                  <TableRow key={feed.id}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedFeedIds.has(feed.id)}
                        onCheckedChange={() => toggleSelect(feed.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {editingFeedId === feed.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveTitle(feed.id)
                              } else if (e.key === 'Escape') {
                                cancelEditing()
                              }
                            }}
                            className="h-8"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => saveTitle(feed.id)}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {feed.title || feed.name || feed.feedName || 'Без названия'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(feed)}
                            className="h-6 w-6 p-0"
                            title="Редактировать название"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="truncate max-w-md text-muted-foreground text-sm">
                        {feed.url || feed.feedUrl || 'URL не указан'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-2">
                        <Badge variant={feed.status === 'active' ? 'default' : 'secondary'}>
                          {feed.status === 'active' ? 'Активен' : 'Отключен'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFeedStatus(feed)}
                          disabled={togglingFeedId === feed.id}
                          className="px-0 text-xs"
                        >
                          {togglingFeedId === feed.id ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Обновление...
                            </span>
                          ) : feed.status === 'active' ? (
                            'Деактивировать'
                          ) : (
                            'Активировать'
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleImportFeed(feed.id)}
                          disabled={importing === feed.id}
                          title="Обновить фид"
                        >
                          <RefreshCw className={`h-4 w-4 ${importing === feed.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedFeedIds(new Set([feed.id]))
                            setPendingAction('delete')
                          }}
                          title="Удалить фид"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Controls */}
          {!loading && filteredFeeds.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Показано {startIndex + 1}-{Math.min(endIndex, filteredFeeds.length)} из {filteredFeeds.length}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">На странице:</span>
                  <div className="flex gap-1">
                    {[25, 50, 100, 200].map((size) => (
                      <Button
                        key={size}
                        variant={pageSize === size ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => changePageSize(size)}
                        className="h-8 w-12"
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Page Navigation */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(1, totalPages)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                    title="Первая страница"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1, totalPages)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                    title="Предыдущая страница"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1 px-2">
                    <span className="text-sm font-medium">{currentPage}</span>
                    <span className="text-sm text-muted-foreground">из</span>
                    <span className="text-sm font-medium">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1, totalPages)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                    title="Следующая страница"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(totalPages, totalPages)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                    title="Последняя страница"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Bulk Actions Panel */}
      {selectedFeedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <Card className="border-primary shadow-2xl">
            <CardContent className="py-4 px-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  Выбрано: <span className="text-primary font-bold">{selectedFeedIds.size}</span> фид(ов)
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleBulkAction('update')}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Обновить
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBulkAction('delete')}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFeedIds(new Set())}
                >
                  Отменить
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Confirmation Dialog for Bulk Actions */}
      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogContent?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              disabled={bulkActionLoading}
              className={`${dialogContent?.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''} flex items-center`}
            >
              {bulkActionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {pendingAction === 'delete' ? 'Удаление...' : 'Выполнение...'}
                </>
              ) : (
                dialogContent?.actionText
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
