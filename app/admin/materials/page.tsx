'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { Material, Category, Theme, Tag, Country, City } from '@/lib/types'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExternalLink, Trash2, Archive, CheckCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles, X } from 'lucide-react'
import { AdminHeader } from '@/components/admin-header'
import { toast } from 'sonner'

type BulkAction = 'published' | 'archived' | 'delete' | 'generate-summary' | null

interface MaterialsStats {
  total: number
  new: number
  processed: number
  archived: number
}

type CountryWithCities = Country & { cities: City[] }

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<BulkAction>(null)
  const [stats, setStats] = useState<MaterialsStats>({ total: 0, new: 0, processed: 0, archived: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [generatingSummary, setGeneratingSummary] = useState<Set<string>>(new Set())
  const [taxonomy, setTaxonomy] = useState<{
    categories: Category[]
    themes: Theme[]
    tags: Tag[]
    countries: CountryWithCities[]
  }>({ categories: [], themes: [], tags: [], countries: [] })
  const [taxonomyLoading, setTaxonomyLoading] = useState(false)
  const [savingTaxonomy, setSavingTaxonomy] = useState(false)
  const [creatingTaxonomy, setCreatingTaxonomy] = useState<null | 'category' | 'theme' | 'tag' | 'country' | 'city'>(null)
  const [newTaxonomyInputs, setNewTaxonomyInputs] = useState({
    category: '',
    theme: '',
    tag: '',
    country: '',
    city: '',
  })
  const [pendingTaxonomy, setPendingTaxonomy] = useState({
    categoryIds: [] as number[],
    themeIds: [] as number[],
    tagIds: [] as number[],
    countryId: null as number | null,
    cityId: null as number | null,
  })

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

  const fetchTaxonomy = async () => {
    try {
      setTaxonomyLoading(true)
      const response = await fetch('/api/taxonomy')
      const result = await response.json()

      if (result.success) {
        setTaxonomy({
          categories: result.categories ?? [],
          themes: result.themes ?? [],
          tags: result.tags ?? [],
          countries: (result.countries ?? []) as CountryWithCities[],
        })
      } else {
        toast.error(result.error || 'Не удалось загрузить таксономию')
      }
    } catch (error) {
      console.error('Error fetching taxonomy:', error)
      toast.error('Не удалось загрузить таксономию')
    } finally {
      setTaxonomyLoading(false)
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
      if (action === 'generate-summary') {
        // Генерация саммари для выбранных материалов
        let successCount = 0
        let errorCount = 0
        let firstError = ''
        
        for (const id of idsArray) {
          setGeneratingSummary(prev => new Set(prev).add(id))
          
          try {
            const response = await fetch('/api/materials/generate-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ materialId: id }),
            })
            
            const result = await response.json()
            
            if (result.success) {
              successCount++
            } else {
              errorCount++
              if (!firstError) {
                firstError = result.error
              }
              console.error(`Failed to generate summary for ${id}:`, result.error)
            }
          } catch (err) {
            errorCount++
            if (!firstError) {
              firstError = err instanceof Error ? err.message : 'Неизвестная ошибка'
            }
            console.error(`Error generating summary for ${id}:`, err)
          } finally {
            setGeneratingSummary(prev => {
              const newSet = new Set(prev)
              newSet.delete(id)
              return newSet
            })
          }
        }
        
        await fetchMaterials(filter)
        setSelectedIds(new Set())
        
        if (errorCount === 0) {
          toast.success(`Саммари успешно сгенерировано для ${successCount} материал(ов)`)
        } else if (successCount === 0) {
          toast.error(`Ошибка: ${firstError}`)
        } else {
          toast.warning(`Успешно: ${successCount}, Ошибки: ${errorCount}. ${firstError}`)
        }
      } else {
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
      }
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
    setCurrentPage(1)
  }

  const openMaterialDialog = (material: Material) => {
    setSelectedMaterial(material)
    setIsDialogOpen(true)
  }

  // Pagination logic
  const totalPages = Math.ceil(materials.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedMaterials = materials.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const changePageSize = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedMaterials.length && paginatedMaterials.length > 0) {
      // Deselect all on current page
      const newSelected = new Set(selectedIds)
      paginatedMaterials.forEach((m: Material) => newSelected.delete(m.id))
      setSelectedIds(newSelected)
    } else {
      // Select all on current page
      const newSelected = new Set(selectedIds)
      paginatedMaterials.forEach((m: Material) => newSelected.add(m.id))
      setSelectedIds(newSelected)
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

  const updateSelection = (key: 'categoryIds' | 'themeIds' | 'tagIds', id: number, checked: boolean) => {
    setPendingTaxonomy((prev) => {
      const values = new Set(prev[key])
      if (checked) {
        values.add(id)
      } else {
        values.delete(id)
      }
      return { ...prev, [key]: Array.from(values) }
    })
  }

  const removeSelection = (key: 'categoryIds' | 'themeIds' | 'tagIds', id: number) => {
    setPendingTaxonomy((prev) => {
      const values = new Set(prev[key])
      values.delete(id)
      return { ...prev, [key]: Array.from(values) }
    })
  }

  const handleCountryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    const countryId = value ? Number(value) : null
    setPendingTaxonomy((prev) => ({
      ...prev,
      countryId,
      cityId: null,
    }))
  }

  const handleCityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    const cityId = value ? Number(value) : null
    setPendingTaxonomy((prev) => ({
      ...prev,
      cityId,
    }))
  }

  const handleNewTaxonomyInputChange = (key: 'category' | 'theme' | 'tag' | 'country' | 'city') => (event: ChangeEvent<HTMLInputElement>) => {
    setNewTaxonomyInputs((prev) => ({
      ...prev,
      [key]: event.target.value,
    }))
  }

  const handleCreateTaxonomyItem = async (type: 'category' | 'theme' | 'tag' | 'country' | 'city') => {
    const value = newTaxonomyInputs[type]
    if (!value.trim()) {
      toast.warning('Введите название')
      return
    }

    if (type === 'city' && !pendingTaxonomy.countryId) {
      toast.warning('Выберите страну перед добавлением города')
      return
    }

    try {
      setCreatingTaxonomy(type)
      const response = await fetch('/api/taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: value,
          countryId: type === 'city' ? pendingTaxonomy.countryId : undefined,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Не удалось создать элемент')
        return
      }

      await fetchTaxonomy()

      switch (type) {
        case 'category':
          setPendingTaxonomy((prev) => ({
            ...prev,
            categoryIds: Array.from(new Set([...prev.categoryIds, result.data.id])),
          }))
          break
        case 'theme':
          setPendingTaxonomy((prev) => ({
            ...prev,
            themeIds: Array.from(new Set([...prev.themeIds, result.data.id])),
          }))
          break
        case 'tag':
          setPendingTaxonomy((prev) => ({
            ...prev,
            tagIds: Array.from(new Set([...prev.tagIds, result.data.id])),
          }))
          break
        case 'country':
          setPendingTaxonomy((prev) => ({
            ...prev,
            countryId: result.data.id,
            cityId: null,
          }))
          break
        case 'city':
          setPendingTaxonomy((prev) => ({
            ...prev,
            cityId: result.data.id,
          }))
          break
      }

      setNewTaxonomyInputs((prev) => ({
        ...prev,
        [type]: '',
      }))

      toast.success('Элемент создан')
    } catch (error) {
      console.error('Error creating taxonomy item:', error)
      toast.error('Не удалось создать элемент')
    } finally {
      setCreatingTaxonomy(null)
    }
  }

  const handleSaveTaxonomy = async () => {
    if (!selectedMaterial) return

    try {
      setSavingTaxonomy(true)
      const response = await fetch('/api/materials/taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: selectedMaterial.id,
          categoryIds: pendingTaxonomy.categoryIds,
          themeIds: pendingTaxonomy.themeIds,
          tagIds: pendingTaxonomy.tagIds,
          countryId: pendingTaxonomy.countryId,
          cityId: pendingTaxonomy.cityId,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Не удалось сохранить таксономию')
        return
      }

      const updated: Material = result.data
      setMaterials((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setSelectedMaterial(updated)
      setPendingTaxonomy({
        categoryIds: updated.categories?.map((item) => item.id) ?? [],
        themeIds: updated.themes?.map((item) => item.id) ?? [],
        tagIds: updated.tags?.map((item) => item.id) ?? [],
        countryId: updated.country?.id ?? null,
        cityId: updated.city?.id ?? null,
      })

      toast.success('Таксономия обновлена')
    } catch (error) {
      console.error('Error saving taxonomy:', error)
      toast.error('Не удалось сохранить таксономию')
    } finally {
      setSavingTaxonomy(false)
    }
  }

  const selectedCountry = pendingTaxonomy.countryId
    ? taxonomy.countries.find((country) => country.id === pendingTaxonomy.countryId)
    : undefined
  const availableCities = selectedCountry?.cities ?? []

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
      case 'generate-summary':
        return {
          title: 'Генерация саммари',
          description: count === 1 
            ? 'Сгенерировать саммари для этого материала?' 
            : `Сгенерировать саммари для ${count} материалов?`,
          actionText: 'Сгенерировать',
          variant: 'default' as const,
        }
      default:
        return null
    }
  }

  const dialogContent = getActionDialogContent()

  return (
    <>
      <AdminHeader />
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
                        variant="secondary"
                        onClick={() => handleBulkActionClick('generate-summary')}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Саммари
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
              {/* Pagination Controls - Top */}
              {!loading && materials.length > 0 && (
                <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Показано {startIndex + 1}-{Math.min(endIndex, materials.length)} из {materials.length}
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
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                        title="Первая страница"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
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
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                        title="Следующая страница"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(totalPages)}
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
                          checked={paginatedMaterials.length > 0 && paginatedMaterials.every((m: Material) => selectedIds.has(m.id))}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-20">Обложка</TableHead>
                      <TableHead className="min-w-[300px]">Заголовок</TableHead>
                      <TableHead className="w-[220px]">Категории</TableHead>
                      <TableHead>Источник</TableHead>
                      <TableHead className="w-[130px]">Дата</TableHead>
                      <TableHead>Статус</TableHead>
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
                        <TableCell className="font-medium" onClick={() => openMaterialDialog(material)}>
                          <div className="line-clamp-3 leading-snug">
                            {material.title}
                          </div>
                        </TableCell>
                        <TableCell onClick={() => openMaterialDialog(material)}>
                          {material.categories && material.categories.length > 0 ? (
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              {material.categories.slice(0, 3).map((category) => (
                                <Badge key={`${material.id}-category-${category.id}`} variant="outline" className="text-xs font-normal">
                                  {category.name}
                                </Badge>
                              ))}
                              {material.categories.length > 3 && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                  +{material.categories.length - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
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

              {/* Pagination Controls */}
              {!loading && materials.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Показано {startIndex + 1}-{Math.min(endIndex, materials.length)} из {materials.length}
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
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                        title="Первая страница"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
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
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                        title="Следующая страница"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(totalPages)}
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
              
              {/* AI Summary */}
              {selectedMaterial?.summary && (
                <div className="mt-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedMaterial.summary}
                </div>
              )}

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
              <div className="mt-6 space-y-6">
                {taxonomyLoading ? (
                  <div className="text-sm text-muted-foreground">Загрузка справочников...</div>
                ) : (
                  <>
                    <div>
                      <Label className="text-sm font-medium">Категории</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pendingTaxonomy.categoryIds.length > 0 ? (
                          pendingTaxonomy.categoryIds.map((id) => {
                            const category = taxonomy.categories.find((item) => item.id === id)
                            if (!category) return null
                            return (
                              <Badge key={`selected-category-${id}`} variant="secondary" className="gap-1">
                                {category.name}
                                <button
                                  type="button"
                                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:text-destructive"
                                  onClick={() => removeSelection('categoryIds', id)}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            )
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground">Не выбрано</span>
                        )}
                      </div>
                      <div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                        {taxonomy.categories.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Список пуст</span>
                        ) : (
                          taxonomy.categories.map((category) => (
                            <label key={category.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={pendingTaxonomy.categoryIds.includes(category.id)}
                                onCheckedChange={(checked) => updateSelection('categoryIds', category.id, checked === true)}
                              />
                              <span>{category.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Input
                          value={newTaxonomyInputs.category}
                          onChange={handleNewTaxonomyInputChange('category')}
                          placeholder="Новая категория"
                          className="h-9"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleCreateTaxonomyItem('category')}
                          disabled={creatingTaxonomy === 'category'}
                        >
                          {creatingTaxonomy === 'category' ? 'Добавление...' : 'Добавить'}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Темы</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pendingTaxonomy.themeIds.length > 0 ? (
                          pendingTaxonomy.themeIds.map((id) => {
                            const theme = taxonomy.themes.find((item) => item.id === id)
                            if (!theme) return null
                            return (
                              <Badge key={`selected-theme-${id}`} variant="secondary" className="gap-1">
                                {theme.name}
                                <button
                                  type="button"
                                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:text-destructive"
                                  onClick={() => removeSelection('themeIds', id)}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            )
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground">Не выбрано</span>
                        )}
                      </div>
                      <div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                        {taxonomy.themes.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Список пуст</span>
                        ) : (
                          taxonomy.themes.map((theme) => (
                            <label key={theme.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={pendingTaxonomy.themeIds.includes(theme.id)}
                                onCheckedChange={(checked) => updateSelection('themeIds', theme.id, checked === true)}
                              />
                              <span>{theme.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Input
                          value={newTaxonomyInputs.theme}
                          onChange={handleNewTaxonomyInputChange('theme')}
                          placeholder="Новая тема"
                          className="h-9"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleCreateTaxonomyItem('theme')}
                          disabled={creatingTaxonomy === 'theme'}
                        >
                          {creatingTaxonomy === 'theme' ? 'Добавление...' : 'Добавить'}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Теги</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pendingTaxonomy.tagIds.length > 0 ? (
                          pendingTaxonomy.tagIds.map((id) => {
                            const tag = taxonomy.tags.find((item) => item.id === id)
                            if (!tag) return null
                            return (
                              <Badge key={`selected-tag-${id}`} variant="secondary" className="gap-1">
                                {tag.name}
                                <button
                                  type="button"
                                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:text-destructive"
                                  onClick={() => removeSelection('tagIds', id)}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            )
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground">Не выбрано</span>
                        )}
                      </div>
                      <div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                        {taxonomy.tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Список пуст</span>
                        ) : (
                          taxonomy.tags.map((tag) => (
                            <label key={tag.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={pendingTaxonomy.tagIds.includes(tag.id)}
                                onCheckedChange={(checked) => updateSelection('tagIds', tag.id, checked === true)}
                              />
                              <span>{tag.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Input
                          value={newTaxonomyInputs.tag}
                          onChange={handleNewTaxonomyInputChange('tag')}
                          placeholder="Новый тег"
                          className="h-9"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleCreateTaxonomyItem('tag')}
                          disabled={creatingTaxonomy === 'tag'}
                        >
                          {creatingTaxonomy === 'tag' ? 'Добавление...' : 'Добавить'}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-sm font-medium">Страна</Label>
                        <select
                          className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                          value={pendingTaxonomy.countryId ?? ''}
                          onChange={handleCountryChange}
                        >
                          <option value="">Не выбрано</option>
                          {taxonomy.countries.map((country) => (
                            <option key={country.id} value={country.id}>
                              {country.name}
                            </option>
                          ))}
                        </select>
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={newTaxonomyInputs.country}
                            onChange={handleNewTaxonomyInputChange('country')}
                            placeholder="Новая страна"
                            className="h-9"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleCreateTaxonomyItem('country')}
                            disabled={creatingTaxonomy === 'country'}
                          >
                            {creatingTaxonomy === 'country' ? 'Добавление...' : 'Добавить'}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Город</Label>
                        <select
                          className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                          value={pendingTaxonomy.cityId ?? ''}
                          onChange={handleCityChange}
                          disabled={!pendingTaxonomy.countryId || availableCities.length === 0}
                        >
                          <option value="">Не выбрано</option>
                          {availableCities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name}
                            </option>
                          ))}
                        </select>
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={newTaxonomyInputs.city}
                            onChange={handleNewTaxonomyInputChange('city')}
                            placeholder="Новый город"
                            className="h-9"
                            disabled={!pendingTaxonomy.countryId}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleCreateTaxonomyItem('city')}
                            disabled={!pendingTaxonomy.countryId || creatingTaxonomy === 'city'}
                          >
                            {creatingTaxonomy === 'city' ? 'Добавление...' : 'Добавить'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSaveTaxonomy} disabled={savingTaxonomy || taxonomyLoading}>
                  {savingTaxonomy ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>

              {(selectedMaterial?.link || selectedMaterial?.source) && (
                <div className="mt-6 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <a 
                      href={selectedMaterial.link || selectedMaterial.source || '#'} 
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
