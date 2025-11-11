'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Filter,
  X,
} from 'lucide-react'

import { Material } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'

type RegionOption = { id: number; name: string }
type CategoryOption = { id: number; name: string }

type CountedOption<T> = {
  value: T
  label: string
  count: number
}

export default function PublicMaterialsPage() {
  const [allMaterials, setAllMaterials] = useState<Material[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [regions, setRegions] = useState<RegionOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])

  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [selectedRegions, setSelectedRegions] = useState<number[]>([])
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])

  const [loading, setLoading] = useState(true)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  useEffect(() => {
  const fetchMaterials = async () => {
    try {
      setLoading(true)
        const response = await fetch('/api/public/materials')
      const result = await response.json()
      
      if (result.success) {
          setAllMaterials(result.data ?? [])
          setSources(result.filters?.sources ?? [])
          setRegions(result.filters?.regions ?? [])
          setCategories(result.filters?.categories ?? [])
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      setLoading(false)
    }
  }

    fetchMaterials()
  }, [])

  const applyFilters = useCallback(
    (
      materials: Material[],
      filters: {
        sources: string[]
        regions: number[]
        categories: number[]
      }
    ) => {
      return materials.filter((material) => {
        const sourceName = (material.feedName || material.source || '').trim()
        if (
          filters.sources.length > 0 &&
          !filters.sources.includes(sourceName)
        ) {
          return false
        }

        const countryId = material.country?.id ?? null
        if (
          filters.regions.length > 0 &&
          (!countryId || !filters.regions.includes(countryId))
        ) {
          return false
        }

        const materialCategoryIds =
          material.categories?.map((category) => category.id) ?? []
        if (
          filters.categories.length > 0 &&
          !filters.categories.some((id) => materialCategoryIds.includes(id))
        ) {
          return false
        }

        return true
      })
    },
    []
  )

  const filteredMaterials = useMemo(
    () =>
      applyFilters(allMaterials, {
        sources: selectedSources,
        regions: selectedRegions,
        categories: selectedCategories,
      }),
    [
      allMaterials,
      applyFilters,
      selectedSources,
      selectedRegions,
      selectedCategories,
    ]
  )

  const sourceCounts = useMemo(() => {
    const base = applyFilters(allMaterials, {
      sources: [],
      regions: selectedRegions,
      categories: selectedCategories,
    })

    const counts = new Map<string, number>()
    base.forEach((material) => {
      const key = (material.feedName || material.source || '').trim()
      if (!key) return
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })

    const options: CountedOption<string>[] = sources.map((name) => ({
      value: name,
      label: name,
      count: counts.get(name) ?? 0,
    }))

    return { total: base.length, options }
  }, [
    allMaterials,
    applyFilters,
    selectedRegions,
    selectedCategories,
    sources,
  ])

  const regionCounts = useMemo(() => {
    const base = applyFilters(allMaterials, {
      sources: selectedSources,
      regions: [],
      categories: selectedCategories,
    })

    const counts = new Map<number, number>()
    base.forEach((material) => {
      const id = material.country?.id
      if (!id) return
      counts.set(id, (counts.get(id) ?? 0) + 1)
    })

    const options: CountedOption<number>[] = regions.map((region) => ({
      value: region.id,
      label: region.name,
      count: counts.get(region.id) ?? 0,
    }))

    return { total: base.length, options }
  }, [
    allMaterials,
    applyFilters,
    selectedSources,
    selectedCategories,
    regions,
  ])

  const categoryCounts = useMemo(() => {
    const base = applyFilters(allMaterials, {
      sources: selectedSources,
      regions: selectedRegions,
      categories: [],
    })

    const counts = new Map<number, number>()
    base.forEach((material) => {
      material.categories?.forEach((category) => {
        counts.set(category.id, (counts.get(category.id) ?? 0) + 1)
      })
    })

    const options: CountedOption<number>[] = categories.map((category) => ({
      value: category.id,
      label: category.name,
      count: counts.get(category.id) ?? 0,
    }))

    return { total: base.length, options }
  }, [
    allMaterials,
    applyFilters,
    selectedSources,
    selectedRegions,
    categories,
  ])

  const handleSourceToggle = (source: string, checked: boolean) => {
    setSelectedSources((prev) => {
      if (checked) {
        return prev.includes(source) ? prev : [...prev, source]
      }
      return prev.filter((item) => item !== source)
    })
    setCurrentPage(1)
  }

  const handleRegionToggle = (regionId: number, checked: boolean) => {
    setSelectedRegions((prev) => {
      if (checked) {
        return prev.includes(regionId) ? prev : [...prev, regionId]
      }
      return prev.filter((id) => id !== regionId)
    })
    setCurrentPage(1)
  }

  const handleCategoryToggle = (categoryId: number, checked: boolean) => {
    setSelectedCategories((prev) => {
      if (checked) {
        return prev.includes(categoryId) ? prev : [...prev, categoryId]
      }
      return prev.filter((id) => id !== categoryId)
    })
    setCurrentPage(1)
  }

  const removeFilterChip = (type: 'source' | 'region' | 'category', value: string | number) => {
    switch (type) {
      case 'source':
        handleSourceToggle(value as string, false)
        break
      case 'region':
        handleRegionToggle(value as number, false)
        break
      case 'category':
        handleCategoryToggle(value as number, false)
        break
    }
  }

  const clearFilters = () => {
    setSelectedSources([])
    setSelectedRegions([])
    setSelectedCategories([])
    setCurrentPage(1)
  }

  const hasActiveFilters =
    selectedSources.length > 0 ||
    selectedRegions.length > 0 ||
    selectedCategories.length > 0

  const selectedRegionObjects = useMemo(
    () => regions.filter((region) => selectedRegions.includes(region.id)),
    [regions, selectedRegions]
  )
  const selectedCategoryObjects = useMemo(
    () => categories.filter((category) => selectedCategories.includes(category.id)),
    [categories, selectedCategories]
  )

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

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMaterials.length / pageSize)
  )
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedMaterials = filteredMaterials.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight uppercase">
              MEDIA SYNDICATE
            </span>
          </Link>
        </div>
      </header>

      <div className="min-h-screen bg-background py-10">
        <div className="container space-y-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-muted-foreground">
                Свежая аналитика и новости из проверенных источников
              </p>

              <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-w-[170px] justify-between">
                    <span>Источники</span>
                    <Badge
                      variant={selectedSources.length > 0 ? 'default' : 'secondary'}
                      className="ml-2"
                    >
                      {selectedSources.length > 0
                        ? selectedSources.length
                        : sourceCounts.total}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Все источники</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => setSelectedSources([])}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    Все источники
                    <Badge variant="secondary">{sourceCounts.total}</Badge>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {sourceCounts.options.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Источники не найдены
            </div>
                  ) : (
                    sourceCounts.options.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedSources.includes(option.value)}
                        onCheckedChange={(checked) =>
                          handleSourceToggle(option.value, checked === true)
                        }
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">{option.label}</span>
                        <Badge variant="secondary">{option.count}</Badge>
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-w-[170px] justify-between">
                    <span>Регионы</span>
                    <Badge
                      variant={selectedRegions.length > 0 ? 'default' : 'secondary'}
                      className="ml-2"
                    >
                      {selectedRegions.length > 0
                        ? selectedRegions.length
                        : regionCounts.total}
                      </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Все регионы</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => setSelectedRegions([])}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    Все регионы
                    <Badge variant="secondary">{regionCounts.total}</Badge>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {regionCounts.options.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Нет доступных регионов
                    </div>
                  ) : (
                    regionCounts.options.map((option) => (
                    <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedRegions.includes(option.value)}
                        onCheckedChange={(checked) =>
                          handleRegionToggle(option.value, checked === true)
                        }
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">{option.label}</span>
                        <Badge variant="secondary">{option.count}</Badge>
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-w-[170px] justify-between">
                    <span>Категории</span>
                    <Badge
                      variant={
                        selectedCategories.length > 0 ? 'default' : 'secondary'
                      }
                      className="ml-2"
                    >
                      {selectedCategories.length > 0
                        ? selectedCategories.length
                        : categoryCounts.total}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Все категории</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => setSelectedCategories([])}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    Все категории
                    <Badge variant="secondary">{categoryCounts.total}</Badge>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {categoryCounts.options.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Категории не найдены
                    </div>
                  ) : (
                    categoryCounts.options.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedCategories.includes(option.value)}
                        onCheckedChange={(checked) =>
                          handleCategoryToggle(option.value, checked === true)
                        }
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">{option.label}</span>
                        <Badge variant="secondary">{option.count}</Badge>
                    </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Очистить фильтры
              </Button>
            </div>
            </div>
          </div>

  {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {selectedSources.map((source) => (
                <Badge key={`source-${source}`} variant="secondary" className="gap-1">
                  {source}
                  <button
                    onClick={() => removeFilterChip('source', source)}
                    className="ml-1 hover:text-destructive"
                    aria-label={`Удалить фильтр ${source}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedRegionObjects.map((region) => (
                <Badge
                  key={`region-${region.id}`}
                  variant="secondary"
                  className="gap-1"
                >
                  Регион: {region.name}
                  <button
                    onClick={() => removeFilterChip('region', region.id)}
                    className="ml-1 hover:text-destructive"
                    aria-label={`Удалить регион ${region.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedCategoryObjects.map((category) => (
                <Badge
                  key={`category-${category.id}`}
                  variant="secondary"
                  className="gap-1"
                >
                  Категория: {category.name}
                  <button
                    onClick={() => removeFilterChip('category', category.id)}
                    className="ml-1 hover:text-destructive"
                    aria-label={`Удалить категорию ${category.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <Card className="border-none bg-muted/30">
            <CardHeader>
              <CardTitle>
                {loading
                  ? 'Загрузка...'
                  : `Материалы: ${filteredMaterials.length}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardContent className="p-6">
                        <Skeleton className="mb-2 h-6 w-3/4" />
                        <Skeleton className="mb-4 h-4 w-full" />
                        <Skeleton className="h-4 w-1/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Материалы по выбранным фильтрам не найдены
                </div>
              ) : (
                <div className="space-y-4">
                  {paginatedMaterials.map((material) => (
                    <Card 
                      key={material.id} 
                      className="cursor-pointer overflow-hidden border border-transparent bg-background transition-colors duration-300 hover:bg-muted/70"
                      onClick={() => openMaterialDialog(material)}
                    >
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4 md:flex-row">
                          {material.thumbnail && (
                            <img 
                              src={material.thumbnail} 
                              alt={material.title}
                              className="h-16 w-16 rounded object-cover md:h-20 md:w-20"
                            />
                          )}
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {(material.feedName || material.source) && (
                                <Badge variant="outline">
                                  {material.feedName || material.source}
                                </Badge>
                              )}
                              {material.country && (
                                <Badge variant="secondary">
                                  {material.country.name}
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-xl font-semibold leading-tight">
                              {material.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(material.createdAt)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!loading && filteredMaterials.length > 0 && (
                <div className="mt-6 flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Показано {startIndex + 1}-
                    {Math.min(endIndex, filteredMaterials.length)} из{' '}
                    {filteredMaterials.length}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1 || totalPages <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1 || totalPages <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm font-medium">
                        {totalPages > 0 ? currentPage : 0}
                      </span>
                      <span className="text-sm text-muted-foreground">из</span>
                      <span className="text-sm font-medium">{totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages || totalPages <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages || totalPages <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl pr-8">
              {selectedMaterial?.title}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  <strong>Автор:</strong> {selectedMaterial?.author || '—'}
                </span>
                <span>
                  <strong>Источник:</strong>{' '}
                  {selectedMaterial?.feedName ||
                    selectedMaterial?.source ||
                    '—'}
                </span>
                <span>
                  <strong>Дата:</strong>{' '}
                  {selectedMaterial && formatDate(selectedMaterial.createdAt)}
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>
 
          {(selectedMaterial?.categories?.length ||
            selectedMaterial?.themes?.length ||
            selectedMaterial?.tags?.length ||
            selectedMaterial?.country ||
            selectedMaterial?.city) && (
            <div className="mt-4 space-y-3 text-sm">
              {selectedMaterial?.categories &&
                selectedMaterial.categories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      Категории:
                    </span>
                  {selectedMaterial.categories.map((category) => (
                      <Badge
                        key={`category-${category.id}`}
                        variant="secondary"
                        className="text-xs font-medium"
                      >
                      {category.name}
                    </Badge>
                  ))}
                </div>
              )}

              {selectedMaterial?.themes &&
                selectedMaterial.themes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      Темы:
                    </span>
                  {selectedMaterial.themes.map((theme) => (
                      <Badge
                        key={`theme-${theme.id}`}
                        variant="secondary"
                        className="text-xs font-medium"
                      >
                      {theme.name}
                    </Badge>
                  ))}
                </div>
              )}

              {selectedMaterial?.tags && selectedMaterial.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">Теги:</span>
                  {selectedMaterial.tags.map((tag) => (
                    <Badge
                      key={`tag-${tag.id}`}
                      variant="outline"
                      className="text-xs font-medium"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}

              {(selectedMaterial?.country || selectedMaterial?.city) && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Регион:</span>{' '}
                  {selectedMaterial?.country?.name || '—'}
                  {selectedMaterial?.city ? `, ${selectedMaterial.city.name}` : ''}
                </div>
              )}
            </div>
          )}

          {selectedMaterial?.summary && (
            <div className="mt-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {selectedMaterial.summary}
            </div>
          )}
          
          {(selectedMaterial?.link || selectedMaterial?.source) && (
            <div className="mt-6 border-t pt-4">
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
    </>
  )
}

