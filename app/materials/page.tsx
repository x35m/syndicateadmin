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
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const fetchMaterials = async (status: string | null = null) => {
    try {
      const url = status
        ? `/api/materials?status=${status}`
        : '/api/materials'

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setMaterials(result.data)
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

  const openMaterialDialog = (material: Material) => {
    setSelectedMaterial(material)
    setIsDialogOpen(true)
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

  const getSanitizedHtml = (html: string) => {
    // Базовая санитизация HTML
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/g, '')
      .replace(/on\w+='[^']*'/g, '')
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header with Navigation */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Материалы</h1>
            <p className="text-muted-foreground mt-2">
              Просмотр и управление материалами из RSS фидов
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">
              ← На главную
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Фильтры</CardTitle>
            <CardDescription>Фильтрация материалов по статусу</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Materials Table */}
        <Card>
          <CardHeader>
            <CardTitle>Список материалов ({materials.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка данных...</div>
            ) : materials.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Нет материалов. Добавьте RSS фиды и нажмите "Синхронизировать" на главной.
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
                              Вернуть
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
  )
}

