'use client'

import { useEffect, useState } from 'react'
import { Material } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { ExternalLink, Trash2, Archive, CheckCircle } from 'lucide-react'
import { Header } from '@/components/header'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchMaterials = async (status: string = 'all') => {
    try {
      const url = status !== 'all'
        ? `/api/materials?status=${status}`
        : '/api/materials'

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setMaterials(result.data)
        setCurrentPage(1)
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

  const handleBulkAction = async (action: 'published' | 'archived' | 'delete') => {
    if (selectedIds.size === 0) {
      alert('Выберите материалы для обработки')
      return
    }

    const confirmMessages = {
      published: `Опубликовать ${selectedIds.size} материал(ов)?`,
      archived: `Архивировать ${selectedIds.size} материал(ов)?`,
      delete: `Удалить ${selectedIds.size} материал(ов)? Это действие необратимо!`,
    }

    if (!confirm(confirmMessages[action])) {
      return
    }

    try {
      for (const id of selectedIds) {
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
      alert(`✅ Действие выполнено для ${selectedIds.size} материал(ов)`)
    } catch (error) {
      console.error('Error performing bulk action:', error)
      alert('Ошибка при выполнении действия')
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
    if (selectedIds.size === paginatedMaterials.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedMaterials.map(m => m.id)))
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
    return new Date(dateString).toLocaleString('ru-RU')
  }

  const getSanitizedHtml = (html: string) => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/g, '')
      .replace(/on\w+='[^']*'/g, '')
  }

  // Pagination
  const totalPages = Math.ceil(materials.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedMaterials = materials.slice(startIndex, endIndex)

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header with Tabs */}
          <div className="flex justify-between items-center">
            <Tabs value={filter} onValueChange={handleFilterChange}>
              <TabsList>
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="new">Новые</TabsTrigger>
                <TabsTrigger value="processed">Опубликованные</TabsTrigger>
                <TabsTrigger value="archived">Архив</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Показать:</span>
              <Button
                variant={itemsPerPage === 25 ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setItemsPerPage(25); setCurrentPage(1); }}
              >
                25
              </Button>
              <Button
                variant={itemsPerPage === 50 ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setItemsPerPage(50); setCurrentPage(1); }}
              >
                50
              </Button>
              <Button
                variant={itemsPerPage === 100 ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setItemsPerPage(100); setCurrentPage(1); }}
              >
                100
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <Card className="border-primary">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Выбрано: {selectedIds.size} материал(ов)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleBulkAction('published')}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Опубликовать
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction('archived')}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Архивировать
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
                </div>
              </CardContent>
            </Card>
          )}

          {/* Materials Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Материалы ({materials.length})
                {totalPages > 1 && (
                  <span className="text-muted-foreground font-normal ml-2">
                    — Страница {currentPage} из {totalPages}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Загрузка данных...</div>
              ) : materials.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет материалов. Добавьте RSS фиды и нажмите "Синхронизировать" на главной.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedIds.size === paginatedMaterials.length && paginatedMaterials.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
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
                      {paginatedMaterials.map((material) => (
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
                          <TableCell className="font-medium max-w-md" onClick={() => openMaterialDialog(material)}>
                            <div className="truncate">{material.title}</div>
                          </TableCell>
                          <TableCell onClick={() => openMaterialDialog(material)}>{material.author || '—'}</TableCell>
                          <TableCell onClick={() => openMaterialDialog(material)}>
                            <div className="truncate max-w-[200px]" title={material.source}>
                              {material.source || '—'}
                            </div>
                          </TableCell>
                          <TableCell onClick={() => openMaterialDialog(material)}>{formatDate(material.createdAt)}</TableCell>
                          <TableCell onClick={() => openMaterialDialog(material)}>{getStatusBadge(material.status)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              {material.status === 'new' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStatusChange(material.id, 'processed')}
                                >
                                  Опубликовать
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
                                  Вернуть
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination Navigation */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Показано {startIndex + 1}-{Math.min(endIndex, materials.length)} из {materials.length}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          ← Назад
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum
                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (currentPage <= 3) {
                              pageNum = i + 1
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = currentPage - 2 + i
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Вперед →
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

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
                      <strong>Источник:</strong> {selectedMaterial?.source || '—'}
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
