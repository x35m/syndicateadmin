'use client'

import { useEffect, useState } from 'react'
import { Material } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter } from 'lucide-react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function PublicMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [allSources, setAllSources] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    fetchMaterials()
  }, [selectedSources])

  const fetchMaterials = async () => {
    try {
      setLoading(true)
      const sourcesParam = selectedSources.length > 0 
        ? `?sources=${selectedSources.join(',')}` 
        : ''
      
      const response = await fetch(`/api/public/materials${sourcesParam}`)
      const result = await response.json()
      
      if (result.success) {
        setMaterials(result.data)
        setAllSources(result.sources || [])
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSource = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    )
    setCurrentPage(1)
  }

  const removeSource = (source: string) => {
    setSelectedSources(prev => prev.filter(s => s !== source))
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSelectedSources([])
    setCurrentPage(1)
  }

  const openMaterialDialog = (material: Material) => {
    setSelectedMaterial(material)
    setIsDialogOpen(true)
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

  // Pagination
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

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight">
              SYNDICATE
            </span>
          </Link>
          <Link href="/admin/login">
            <Button variant="ghost" size="sm">
              Админ-панель
            </Button>
          </Link>
        </div>
      </header>

      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-6">
          {/* Filters and Title */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Материалы</h1>
              <p className="text-muted-foreground mt-2">
                Публикации из различных источников
              </p>
            </div>

            {/* Source Filter */}
            {allSources.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Источники
                    {selectedSources.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedSources.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {allSources.map((source) => (
                    <DropdownMenuCheckboxItem
                      key={source}
                      checked={selectedSources.includes(source)}
                      onCheckedChange={() => toggleSource(source)}
                    >
                      {source}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Selected Filters as Badges */}
          {selectedSources.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Фильтры:</span>
              {selectedSources.map((source) => (
                <Badge key={source} variant="secondary" className="gap-1">
                  {source}
                  <button
                    onClick={() => removeSource(source)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7"
              >
                Сбросить всё
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {loading ? 'Загрузка...' : `Всего: ${materials.length}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Pagination - Top */}
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
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
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
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardContent className="p-6">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full mb-4" />
                        <Skeleton className="h-4 w-1/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : materials.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {selectedSources.length > 0 
                    ? 'Нет материалов с выбранными фильтрами' 
                    : 'Нет опубликованных материалов'}
                </div>
              ) : (
                <div className="space-y-4">
                  {paginatedMaterials.map((material) => (
                    <Card 
                      key={material.id} 
                      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => openMaterialDialog(material)}
                    >
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          {material.thumbnail && (
                            <img 
                              src={material.thumbnail} 
                              alt={material.title}
                              className="w-32 h-32 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold mb-2 line-clamp-2">
                              {material.title}
                            </h3>
                            <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                              {material.content}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{material.feedName || material.source}</span>
                              <span>•</span>
                              <span>{formatDate(material.createdAt)}</span>
                              {material.author && (
                                <>
                                  <span>•</span>
                                  <span>{material.author}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Pagination - Bottom */}
              {!loading && materials.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Показано {startIndex + 1}-{Math.min(endIndex, materials.length)} из {materials.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
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

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
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
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
    </>
  )
}

