'use client'

import { useEffect, useState } from 'react'
import { Material } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink, Trash2, Archive, CheckCircle } from 'lucide-react'
import { Header } from '@/components/header'
import { toast } from 'sonner'

type BulkAction = 'published' | 'archived' | 'delete' | null

interface MaterialsStats {
  total: number
  new: number
  processed: number
  archived: number
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<BulkAction>(null)
  const [stats, setStats] = useState<MaterialsStats>({ total: 0, new: 0, processed: 0, archived: 0 })

  const fetchMaterials = async (status: string = 'all') => {
    try {
      const url = status !== 'all'
        ? `/api/materials?status=${status}`
        : '/api/materials'

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setMaterials(result.data)
        setStats(result.stats || { total: 0, new: 0, processed: 0, archived: 0 })
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
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
        setSelectedIds(new Set())
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleBulkActionClick = (action: BulkAction) => {
    if (selectedIds.size === 0) {
      toast.warning('Выберите материалы для обработки')
      return
    }
    setPendingAction(action)
  }

  const executeBulkAction = async () => {
    if (!pendingAction) return

    const action = pendingAction
    const idsArray = Array.from(selectedIds)

    try {
      for (const id of idsArray) {
        if (action === 'delete') {
          await fetch(`/api/materials?id=${id}`, {
            method: 'DELETE',
          })
        } else {
          await handleStatusChange(id, action === 'published' ? 'processed' : 'archived')
        }
      }

      await fetchMaterials(filter)
      setSelectedIds(new Set())
      
      const actionNames = {
        published: 'опубликовано',
        archived: 'архивировано',
        delete: 'удалено',
      }
      
      toast.success(`Успешно ${actionNames[action]} ${idsArray.length} материал(ов)`)
    } catch (error) {
      console.error('Error performing bulk action:', error)
      toast.error('Ошибка при выполнении действия')
    } finally {
      setPendingAction(null)
    }
  }

  const handleFilterChange = async (value: string) => {
    setFilter(value)
    setLoading(true)
    await fetchMaterials(value)
    setLoading(false)
    setSelectedIds(new Set())
  }

  const openMaterialDialog = (material: Material) => {
    setSelectedMaterial(material)
    setIsDialogOpen(true)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === materials.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(materials.map(m => m.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchMaterials(filter)
      setLoading(false)
    }

    loadData()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default">Новый</Badge>
      case 'processed':
        return <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">Опубликован</Badge>
      case 'archived':
        return <Badge variant="outline">Архив</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} ${hours}:${minutes}`
  }

  const getSanitizedHtml = (html: string) => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/g, '')
      .replace(/on\w+='[^']*'/g, '')
  }

  const getActionDialogContent = () => {
    const count = selectedIds.size
    switch (pendingAction) {
      case 'published':
        return {
          title: 'Опубликовать материалы',
          description: `Вы уверены, что хотите опубликовать ${count} материал(ов)?`,
          actionText: 'Опубликовать',
          variant: 'default' as const,
        }
      case 'archived':
        return {
          title: 'Архивировать материалы',
          description: `Вы уверены, что хотите архивировать ${count} материал(ов)?`,
          actionText: 'Архивировать',
          variant: 'default' as const,
        }
      case 'delete':
        return {
          title: 'Удалить материалы',
          description: `Вы уверены, что хотите удалить ${count} материал(ов)? Это действие необратимо!`,
          actionText: 'Удалить',
          variant: 'destructive' as const,
        }
      default:
        return null
    }
  }

  const dialogContent = getActionDialogContent()

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-6">
          {/* Header with Tabs */}
          <div className="flex justify-between items-center">
            <Tabs value={filter} onValueChange={handleFilterChange}>
              <TabsList>
                <TabsTrigger value="all">
                  Все {stats.total > 0 && <span className="ml-1.5 text-xs">({stats.total})</span>}
                </TabsTrigger>
                <TabsTrigger value="new">
                  Новые {stats.new > 0 && <span className="ml-1.5 text-xs">({stats.new})</span>}
                </TabsTrigger>
                <TabsTrigger value="processed">
                  Опубликованные {stats.processed > 0 && <span className="ml-1.5 text-xs">({stats.processed})</span>}
                </TabsTrigger>
                <TabsTrigger value="archived">
                  Архив {stats.archived > 0 && <span className="ml-1.5 text-xs">({stats.archived})</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Floating Bulk Actions Panel */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
              <Card className="border-primary shadow-2xl">
                <CardContent className="py-4 px-6">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      Выбрано: <span className="text-primary font-bold">{selectedIds.size}</span> материал(ов)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleBulkActionClick('published')}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Опубликовать
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkActionClick('archived')}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Архивировать
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleBulkActionClick('delete')}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Удалить
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Отменить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Materials Table */}
          <Card>
            <CardHeader>
              <CardTitle>Материалы ({materials.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12" />
                      <Skeleton className="h-16 w-16 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : materials.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет материалов. Добавьте RSS фиды и синхронизируйте их на главной.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === materials.length && materials.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-20">Обложка</TableHead>
                      <TableHead className="min-w-[300px]">Заголовок</TableHead>
                      <TableHead>Автор</TableHead>
                      <TableHead>Название источника</TableHead>
                      <TableHead className="w-[130px]">Дата</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => (
                      <TableRow key={material.id} className="cursor-pointer hover:bg-accent/50">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(material.id)}
                            onCheckedChange={() => toggleSelect(material.id)}
                          />
                        </TableCell>
                        <TableCell onClick={() => openMaterialDialog(material)}>
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
                        <TableCell className="font-medium" onClick={() => openMaterialDialog(material)}>
                          <div className="line-clamp-3 leading-snug">
                            {material.title}
                          </div>
                        </TableCell>
                        <TableCell onClick={() => openMaterialDialog(material)}>{material.author || '—'}</TableCell>
                        <TableCell onClick={() => openMaterialDialog(material)}>
                          <div className="truncate max-w-[200px]" title={material.feedName || material.source}>
                            {material.feedName || material.source || '—'}
                          </div>
                        </TableCell>
                        <TableCell onClick={() => openMaterialDialog(material)}>{formatDate(material.createdAt)}</TableCell>
                        <TableCell onClick={() => openMaterialDialog(material)}>{getStatusBadge(material.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

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
                  className={dialogContent?.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                >
                  {dialogContent?.actionText}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Material Details Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl pr-8">
                  {selectedMaterial?.title}
                </DialogTitle>
                <DialogDescription className="space-y-2">
                  <div className="flex gap-4 text-sm">
                    <span>
                      <strong>Автор:</strong> {selectedMaterial?.author || '—'}
                    </span>
                    <span>
                      <strong>Источник:</strong> {selectedMaterial?.feedName || selectedMaterial?.source || '—'}
                    </span>
                    <span>
                      <strong>Дата:</strong> {selectedMaterial && formatDate(selectedMaterial.createdAt)}
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                {selectedMaterial?.fullContent ? (
                  <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ 
                      __html: getSanitizedHtml(selectedMaterial.fullContent) 
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground">{selectedMaterial?.content}</p>
                )}
              </div>
              {selectedMaterial?.source && (
                <div className="mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <a 
                      href={selectedMaterial.source} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Открыть источник
                    </a>
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  )
}
