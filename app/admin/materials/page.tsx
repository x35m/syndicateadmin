'use client'

import { ChangeEvent, useEffect, useMemo, useState, useCallback } from 'react'
import { Material, Category, Country, City } from '@/lib/types'
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
import {
  ExternalLink,
  Trash2,
  Archive,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  X,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { AdminHeader } from '@/components/admin-header'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

type BulkAction = 'published' | 'archived' | 'delete' | 'generate-summary' | null

interface MaterialsStats {
  total: number
  new: number
  processed: number
  published: number
  archived: number
}

type CountryWithCities = Country & { cities: City[] }

const initialMaterialFilters = {
  search: '',
  categories: [] as number[],
  countries: [] as number[],
  cities: [] as number[],
  feeds: [] as string[],
}

type MaterialFiltersState = typeof initialMaterialFilters

interface FilterMultiSelectProps<T extends string | number> {
  label: string
  options: Array<{ value: T; label: string }>
  selected: T[]
  onChange: (values: T[]) => void
  disabled?: boolean
}

function FilterMultiSelect<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  disabled,
}: FilterMultiSelectProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const toggleValue = (value: T) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(query)
    )
  }, [options, searchTerm])

  return (
    <DropdownMenu onOpenChange={(open) => !open && setSearchTerm('')}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[160px] justify-between"
        >
          <span>{label}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {selected.length > 0 && (
              <Badge variant="secondary" className="px-1 text-xs font-medium">
                {selected.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-1">
          <Input
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-8"
          />
        </div>
        <DropdownMenuSeparator />
        {filteredOptions.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Ничего не найдено
          </div>
        ) : (
          filteredOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={String(option.value)}
              checked={selected.includes(option.value)}
              onCheckedChange={() => toggleValue(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showFullContent, setShowFullContent] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<BulkAction>(null)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [togglingProcessed, setTogglingProcessed] = useState<Set<string>>(new Set())
  const [togglingPublished, setTogglingPublished] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<MaterialsStats>({ total: 0, new: 0, processed: 0, published: 0, archived: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [generatingSummary, setGeneratingSummary] = useState<Set<string>>(new Set())
  const [taxonomy, setTaxonomy] = useState<{
    categories: Category[]
    countries: CountryWithCities[]
  }>({ categories: [], countries: [] })
  const [taxonomyLoading, setTaxonomyLoading] = useState(false)
  const [materialFilters, setMaterialFilters] = useState<MaterialFiltersState>(initialMaterialFilters)
  const [savingTaxonomy, setSavingTaxonomy] = useState(false)
  const [regeneratingTaxonomy, setRegeneratingTaxonomy] = useState(false)
  const [creatingTaxonomy, setCreatingTaxonomy] =
    useState<null | 'category' | 'country' | 'city'>(null)
  const [newTaxonomyInputs, setNewTaxonomyInputs] = useState({
    category: '',
    country: '',
    city: '',
  })
  const [pendingTaxonomy, setPendingTaxonomy] = useState({
    categoryIds: [] as number[],
    countryIds: [] as number[],
    cityIds: [] as number[],
  })

  const availableFeeds = useMemo(() => {
    const feeds = new Set<string>()
    materials.forEach((material) => {
      const feedName = material.feedName || material.source
      if (feedName) {
        feeds.add(feedName)
      }
    })
    return Array.from(feeds).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [materials])

  const filterCityOptions = useMemo(() => {
    const list: Array<{ value: number; label: string }> = []
    taxonomy.countries.forEach((country) => {
      country.cities.forEach((city) => {
        list.push({
          value: city.id,
          label: `${city.name} — ${country.name}`,
        })
      })
    })
    return list.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [taxonomy.countries])

  const filtersApplied = useMemo(() => {
    return (
      materialFilters.search.trim().length > 0 ||
      materialFilters.categories.length > 0 ||
      materialFilters.countries.length > 0 ||
      materialFilters.cities.length > 0 ||
      materialFilters.feeds.length > 0
    )
  }, [materialFilters])

  const fetchMaterials = useCallback(
    async (
      status: string = 'all',
      page: number = currentPage,
      options: { silent?: boolean } = {}
    ) => {
      const silent = options.silent ?? false
      if (!silent) {
        setLoading(true)
      }
    try {
      const params = new URLSearchParams()
      params.set('status', status)
      params.set('page', page.toString())
      params.set('pageSize', pageSize.toString())
      
      // Add filters
      if (materialFilters.search) {
        params.set('search', materialFilters.search)
      }
      if (materialFilters.categories.length > 0) {
        params.set('categoryIds', materialFilters.categories.join(','))
      }
      if (materialFilters.countries.length > 0) {
        params.set('countryIds', materialFilters.countries.join(','))
      }
      if (materialFilters.cities.length > 0) {
        params.set('cityIds', materialFilters.cities.join(','))
      }
      if (materialFilters.feeds.length > 0) {
        params.set('feedNames', materialFilters.feeds.join(','))
      }

      const response = await fetch(`/api/materials?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setMaterials(result.data)
        if (result.pagination) {
          setTotalPages(result.pagination.totalPages)
          setTotal(result.pagination.total)
          setCurrentPage(result.pagination.page)
        }
        setStats(
          result.stats || {
            total: 0,
            new: 0,
            processed: 0,
            published: 0,
            archived: 0,
          }
        )
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
    },
    [materialFilters, pageSize, currentPage]
  )

  const patchMaterial = useCallback(
    async (
      id: string,
      payload: { status?: Material['status']; processed?: boolean; published?: boolean }
    ) => {
      const response = await fetch('/api/materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Не удалось обновить материал')
      }
    },
    []
  )

  const computeStatus = (
    processedFlag: boolean,
    publishedFlag: boolean,
    currentStatus: Material['status']
  ): Material['status'] => {
    if (currentStatus === 'archived') {
      return 'archived'
    }
    if (publishedFlag) {
      return 'published'
    }
    if (processedFlag) {
      return 'processed'
    }
    return 'new'
  }

  const toggleProcessed = async (material: Material, value: boolean) => {
    setTogglingProcessed((prev) => {
      const next = new Set(prev)
      next.add(material.id)
      return next
    })

    const nextStatus = computeStatus(value, material.published, material.status)
    const payload: { processed: boolean; status?: Material['status'] } = { processed: value }
    if (material.status !== nextStatus) {
      payload.status = nextStatus
    }

    try {
      await patchMaterial(material.id, payload)
      toast.success(value ? 'Материал отмечен как обработанный' : 'Материал отмечен как необработанный')
      setSelectedMaterial((prev) =>
        prev && prev.id === material.id
          ? { ...prev, processed: value, status: payload.status ?? prev.status }
          : prev
      )
      await fetchMaterials(filter, currentPage, { silent: true })
    } catch (error) {
      console.error('Error updating processed status:', error)
      toast.error('Не удалось обновить статус обработки')
    } finally {
      setTogglingProcessed((prev) => {
        const next = new Set(prev)
        next.delete(material.id)
        return next
      })
    }
  }

  const togglePublished = async (material: Material, value: boolean) => {
    setTogglingPublished((prev) => {
      const next = new Set(prev)
      next.add(material.id)
      return next
    })

    const nextStatus = computeStatus(material.processed, value, material.status)
    const payload: { published: boolean; status?: Material['status'] } = { published: value }
    if (material.status !== nextStatus) {
      payload.status = nextStatus
    }

    try {
      await patchMaterial(material.id, payload)
      toast.success(value ? 'Материал опубликован' : 'Публикация снята')
      setSelectedMaterial((prev) =>
        prev && prev.id === material.id
          ? { ...prev, published: value, status: payload.status ?? prev.status }
          : prev
      )
      await fetchMaterials(filter, currentPage, { silent: true })
    } catch (error) {
      console.error('Error updating publication status:', error)
      toast.error('Не удалось обновить статус публикации')
    } finally {
      setTogglingPublished((prev) => {
        const next = new Set(prev)
        next.delete(material.id)
        return next
      })
    }
  }

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds(new Set())
  }, [materialFilters, filter])

  useEffect(() => {
    if (!isDialogOpen) {
      setShowFullContent(false)
    }
  }, [isDialogOpen])

  // Fetch materials when filters or page change
  useEffect(() => {
    fetchMaterials(filter, currentPage)
  }, [fetchMaterials, filter, currentPage])

  // SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource(`/api/materials/stream?status=${filter}`)
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'new-material') {
          // Add new material to the list if it matches current filters
          const newMaterial = data.data
          
          // Check if material matches current filters
          let matches = true
          
          if (materialFilters.categories.length > 0) {
            const ids = newMaterial.categories?.map((item: any) => item.id) ?? []
            if (!materialFilters.categories.some((id) => ids.includes(id))) {
              matches = false
            }
          }
          
          if (matches && materialFilters.countries.length > 0) {
            const countryIds =
              Array.isArray(newMaterial.countries)
                ? newMaterial.countries.map((item: any) => item.id)
                : []
            if (!materialFilters.countries.some((id) => countryIds.includes(id))) {
              matches = false
            }
          }
          
          if (matches && materialFilters.cities.length > 0) {
            const cityIds =
              Array.isArray(newMaterial.cities)
                ? newMaterial.cities.map((item: any) => item.id)
                : []
            if (!materialFilters.cities.some((id) => cityIds.includes(id))) {
              matches = false
            }
          }
          
          if (matches && materialFilters.feeds.length > 0) {
            const feedName = newMaterial.feedName || newMaterial.source || ''
            if (!materialFilters.feeds.includes(feedName)) {
              matches = false
            }
          }
          
          if (matches && materialFilters.search.trim()) {
            const query = materialFilters.search.trim().toLowerCase()
            const haystack = [
              newMaterial.title,
              newMaterial.summary,
              newMaterial.content,
              newMaterial.feedName,
              newMaterial.source,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
            
            if (!haystack.includes(query)) {
              matches = false
            }
          }
          
          // Check status filter
          if (matches && filter !== 'all') {
            if (filter === 'processed' && !newMaterial.processed) {
              matches = false
            } else if (filter === 'published' && !newMaterial.published) {
              matches = false
            } else if (filter === 'archived' && newMaterial.status !== 'archived') {
              matches = false
            } else if (
              filter === 'new' &&
              (newMaterial.processed || newMaterial.status === 'archived')
            ) {
              matches = false
            } else if (!['processed', 'published', 'archived', 'new'].includes(filter)) {
              if (newMaterial.status !== filter) {
                matches = false
              }
            }
          }
          
          if (matches) {
            // Add to beginning of list if on first page, otherwise refresh
            if (currentPage === 1) {
              setMaterials((prev) => [newMaterial, ...prev].slice(0, pageSize))
              setTotal((prev) => prev + 1)
            } else {
              // Refresh current page
              fetchMaterials(filter, currentPage)
            }
          }
        } else if (data.type === 'sync-complete') {
          // Refresh stats after sync
          fetchMaterials(filter, currentPage)
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      // Reconnect after 5 seconds
      setTimeout(() => {
        eventSource.close()
        // Will reconnect via useEffect
      }, 5000)
    }
    
    return () => {
      eventSource.close()
    }
  }, [filter, materialFilters, currentPage, pageSize, fetchMaterials])

  const fetchTaxonomy = async () => {
    try {
      setTaxonomyLoading(true)
      const response = await fetch('/api/taxonomy')
      const result = await response.json()

      if (result.success) {
        setTaxonomy({
          categories: result.categories ?? [],
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

    setBulkActionLoading(true)
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
        await fetchTaxonomy()
        setSelectedIds(new Set())
        
        if (errorCount === 0) {
          toast.success(`Саммари успешно сгенерировано для ${successCount} материал(ов)`)
        } else if (successCount === 0) {
          toast.error(`Ошибка: ${firstError}`)
        } else {
          toast.warning(`Успешно: ${successCount}, Ошибки: ${errorCount}. ${firstError}`)
        }
      } else {
          if (action === 'delete') {
          for (const id of idsArray) {
            await fetch(`/api/materials?id=${id}`, {
              method: 'DELETE',
            })
          }
        } else if (action === 'published') {
          const materialsById = new Map(materials.map((item) => [item.id, item]))
          for (const id of idsArray) {
            const material = materialsById.get(id)
            const nextStatus = computeStatus(material?.processed ?? false, true, material?.status ?? 'new')
            await patchMaterial(id, {
              published: true,
              status: nextStatus,
            })
          }
        } else if (action === 'archived') {
          for (const id of idsArray) {
            await patchMaterial(id, {
              status: 'archived',
              published: false,
            })
          }
        }

        await fetchMaterials(filter, currentPage)
        setSelectedIds(new Set())
        
        const actionNames = {
          published: 'опубликовано',
          archived: 'архивировано',
          delete: 'удалено',
        }
        
        toast.success(
          `Успешно ${actionNames[action as keyof typeof actionNames]} ${idsArray.length} материал(ов)`
        )
      }
    } catch (error) {
      console.error('Error performing bulk action:', error)
      toast.error('Ошибка при выполнении действия')
    } finally {
      setBulkActionLoading(false)
      setPendingAction(null)
    }
  }

  const handleFilterChange = async (value: string) => {
    setFilter(value)
    setMaterialFilters(initialMaterialFilters)
    await fetchMaterials(value)
    setSelectedIds(new Set())
    setCurrentPage(1)
  }

  const openMaterialDialog = (material: Material) => {
    setSelectedMaterial(material)
    setPendingTaxonomy({
      categoryIds: material.categories?.map((item) => item.id) ?? [],
      countryIds: material.countries?.map((item) => item.id) ?? [],
      cityIds: material.cities?.map((item) => item.id) ?? [],
    })
    setShowFullContent(false)
    setIsDialogOpen(true)
  }

  // Pagination logic - materials already paginated from server
  const paginatedMaterials = materials
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + materials.length

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

  const removeSelection = (key: 'categoryIds' | 'countryIds' | 'cityIds', id: number) => {
    setPendingTaxonomy((prev) => {
      const values = new Set(prev[key])
        values.delete(id)
      return { ...prev, [key]: Array.from(values) }
    })
  }

  const handleClearTaxonomy = (key: 'categoryIds' | 'countryIds' | 'cityIds') => {
    setPendingTaxonomy((prev) => ({ ...prev, [key]: [] }))
  }

  const handleNewTaxonomyInputChange = (key: 'category' | 'country' | 'city') => (event: ChangeEvent<HTMLInputElement>) => {
    setNewTaxonomyInputs((prev) => ({
      ...prev,
      [key]: event.target.value,
    }))
  }

  const handleCreateTaxonomyItem = async (type: 'category' | 'country' | 'city') => {
    const value = newTaxonomyInputs[type]
    if (!value.trim()) {
      toast.warning('Введите название')
      return
    }

    if (type === 'city') {
      if (pendingTaxonomy.countryIds.length === 0) {
        toast.warning('Выберите хотя бы одну страну перед добавлением города')
        return
      }

      const firstCountryId = pendingTaxonomy.countryIds[0]

      try {
        setCreatingTaxonomy(type)
        const response = await fetch('/api/taxonomy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            name: value,
            countryId: firstCountryId,
          }),
        })

        const result = await response.json()

        if (!result.success) {
          toast.error(result.error || 'Не удалось создать элемент')
          return
        }

        await fetchTaxonomy()
        setPendingTaxonomy((prev) => ({
          ...prev,
          cityIds: Array.from(new Set([...prev.cityIds, result.data.id])),
        }))
        setNewTaxonomyInputs((prev) => ({ ...prev, [type]: '' }))
        toast.success('Элемент создан')
      } catch (error) {
        console.error('Error creating taxonomy item:', error)
        toast.error('Ошибка при создании элемента')
      } finally {
        setCreatingTaxonomy(null)
      }
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
        case 'country':
          setPendingTaxonomy((prev) => ({
            ...prev,
            countryIds: Array.from(new Set([...prev.countryIds, result.data.id])),
          }))
          break
      }
      setNewTaxonomyInputs((prev) => ({ ...prev, [type]: '' }))
      toast.success('Элемент создан')
    } catch (error) {
      console.error('Error creating taxonomy item:', error)
      toast.error('Ошибка при создании элемента')
    } finally {
      setCreatingTaxonomy(null)
    }
  }

  const handleRegenerateTaxonomy = async () => {
    if (!selectedMaterial) return

    try {
      setRegeneratingTaxonomy(true)
      const response = await fetch('/api/materials/regenerate-taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId: selectedMaterial.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при регенерации таксономии')
      }

      if (result.success && result.data?.material) {
        const updatedMaterial = result.data.material
        
        // Обновляем selectedMaterial
        setSelectedMaterial(updatedMaterial)
        
        // Обновляем pendingTaxonomy с новыми значениями
        setPendingTaxonomy({
          categoryIds: updatedMaterial.categories?.map((item: Category) => item.id) ?? [],
          countryIds: updatedMaterial.countries?.map((item: Country) => item.id) ?? [],
          cityIds: updatedMaterial.cities?.map((item: City) => item.id) ?? [],
        })

        // Обновляем материал в списке
        setMaterials((prev) =>
          prev.map((m) => (m.id === updatedMaterial.id ? updatedMaterial : m))
        )

        toast.success('Таксономия успешно обновлена')
        
        // Обновляем справочники на случай если были созданы новые элементы
        await fetchTaxonomy()
      }
    } catch (error: any) {
      console.error('Error regenerating taxonomy:', error)
      toast.error(error.message || 'Ошибка при регенерации таксономии')
    } finally {
      setRegeneratingTaxonomy(false)
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
          countryIds: pendingTaxonomy.countryIds,
          cityIds: pendingTaxonomy.cityIds,
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
        countryIds: updated.countries?.map((item) => item.id) ?? [],
        cityIds: updated.cities?.map((item) => item.id) ?? [],
      })

      toast.success('Таксономия обновлена')
    } catch (error) {
      console.error('Error saving taxonomy:', error)
      toast.error('Не удалось сохранить таксономию')
    } finally {
      setSavingTaxonomy(false)
    }
  }


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default">Новый</Badge>
      case 'processed':
        return <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">Обработанные</Badge>
      case 'published':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">Опубликован</Badge>
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

  useEffect(() => {
    const initialize = async () => {
      await fetchMaterials('all')
      await fetchTaxonomy()
    }

    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                  Обработанные {stats.processed > 0 && <span className="ml-1.5 text-xs">({stats.processed})</span>}
                </TabsTrigger>
                <TabsTrigger value="published">
                  Опубликованные {stats.published > 0 && <span className="ml-1.5 text-xs">({stats.published})</span>}
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
              <CardTitle>
                Материалы ({total})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="Поиск…"
                    value={materialFilters.search}
                    onChange={(event) =>
                      setMaterialFilters((prev) => ({
                        ...prev,
                        search: event.target.value,
                      }))
                    }
                    className="h-9 w-full sm:w-64"
                  />
                  <FilterMultiSelect
                    label="Категории"
                    options={taxonomy.categories.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                    selected={materialFilters.categories}
                    onChange={(values) =>
                      setMaterialFilters((prev) => ({ ...prev, categories: values }))
                    }
                    disabled={taxonomy.categories.length === 0}
                  />
                  <FilterMultiSelect
                    label="Страны"
                    options={taxonomy.countries.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                    selected={materialFilters.countries}
                    onChange={(values) =>
                      setMaterialFilters((prev) => ({ ...prev, countries: values }))
                    }
                    disabled={taxonomy.countries.length === 0}
                  />
                  <FilterMultiSelect
                    label="Города"
                    options={filterCityOptions}
                    selected={materialFilters.cities}
                    onChange={(values) =>
                      setMaterialFilters((prev) => ({ ...prev, cities: values }))
                    }
                    disabled={filterCityOptions.length === 0}
                  />
                  <FilterMultiSelect
                    label="Источники"
                    options={availableFeeds.map((feed) => ({
                      value: feed,
                      label: feed,
                    }))}
                    selected={materialFilters.feeds}
                    onChange={(values) =>
                      setMaterialFilters((prev) => ({ ...prev, feeds: values }))
                    }
                    disabled={availableFeeds.length === 0}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMaterialFilters(initialMaterialFilters)}
                    disabled={!filtersApplied}
                  >
                    Сбросить фильтры
                  </Button>
                </div>
              </div>

              {/* Pagination Controls - Top */}
              {!loading && materials.length > 0 && (
                <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Показано {materials.length === 0 ? 0 : startIndex + 1}-
                      {endIndex} из {total}
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
                  {filtersApplied
                    ? 'Материалы по выбранным фильтрам не найдены.'
                    : 'Нет материалов. Добавьте RSS фиды и синхронизируйте их на главной.'}
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
                      <TableHead className="w-[140px]">Саммари</TableHead>
                      <TableHead className="w-[160px]">Статус обработки</TableHead>
                      <TableHead className="w-[160px]">Статус публикации</TableHead>
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
                        <TableCell onClick={() => openMaterialDialog(material)}>
                          {generatingSummary.has(material.id) ? (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                              Генерация...
                            </Badge>
                          ) : material.summary && material.summary.trim().length > 0 ? (
                            <Badge variant="default">Есть</Badge>
                          ) : (
                            <Badge variant="outline">Нет</Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={() => openMaterialDialog(material)}>
                          <Badge
                            variant={material.processed ? 'secondary' : 'outline'}
                            className={
                              material.processed
                                ? 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400'
                                : 'text-muted-foreground'
                            }
                          >
                            {material.processed ? 'Обработан' : 'Не обработан'}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={material.published ? 'secondary' : 'outline'}
                              className={
                                material.published
                                  ? 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                  : 'text-muted-foreground'
                              }
                            >
                              {material.published ? 'Опубликован' : 'Не опубликован'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => togglePublished(material, !material.published)}
                              disabled={togglingPublished.has(material.id) || bulkActionLoading}
                              title={
                                material.published
                                  ? 'Снять публикацию'
                                  : 'Опубликовать материал'
                              }
                            >
                              {togglingPublished.has(material.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : material.published ? (
                                <X className="h-4 w-4 text-red-500" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-blue-500" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
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
                      Показано {materials.length === 0 ? 0 : startIndex + 1}-
                      {endIndex} из {total}
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

          {/* Material Details Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="w-[min(95vw,1100px)] max-h-[85vh] overflow-y-auto">
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
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={selectedMaterial?.processed ? 'secondary' : 'outline'}
                      className={
                        selectedMaterial?.processed
                          ? 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'text-muted-foreground'
                      }
                    >
                      {selectedMaterial?.processed ? 'Обработан' : 'Не обработан'}
                    </Badge>
                    <Badge
                      variant={selectedMaterial?.published ? 'secondary' : 'outline'}
                      className={
                        selectedMaterial?.published
                          ? 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                          : 'text-muted-foreground'
                      }
                    >
                      {selectedMaterial?.published ? 'Опубликован' : 'Не опубликован'}
                    </Badge>
                  </div>
                  {selectedMaterial && (
                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedMaterial.processed}
                          onCheckedChange={(checked) =>
                            toggleProcessed(selectedMaterial, checked === true)
                          }
                          disabled={togglingProcessed.has(selectedMaterial.id)}
                        />
                        <span>
                          {togglingProcessed.has(selectedMaterial.id)
                            ? 'Обновляем статус обработки...'
                            : 'Обработан'}
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedMaterial.published}
                          onCheckedChange={(checked) =>
                            togglePublished(selectedMaterial, checked === true)
                          }
                          disabled={togglingPublished.has(selectedMaterial.id)}
                        />
                        <span>
                          {togglingPublished.has(selectedMaterial.id)
                            ? 'Обновляем статус публикации...'
                            : 'Опубликован'}
                        </span>
                      </label>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              {selectedMaterial?.metaDescription && (
                <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Meta description
                  </div>
                  <p className="mt-2 text-foreground">{selectedMaterial.metaDescription}</p>
                </div>
              )}

              {selectedMaterial?.summary && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Саммари
                    </span>
                    <Badge variant="secondary">AI</Badge>
                  </div>
                  <div className="rounded-lg border bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedMaterial.summary}
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Полный текст
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFullContent((prev) => !prev)}
                  >
                    {showFullContent ? 'Скрыть текст' : 'Показать текст'}
                  </Button>
                </div>
                <div className="rounded-lg border bg-background p-4 text-sm leading-relaxed">
                  {showFullContent ? (
                    selectedMaterial?.fullContent ? (
                      <div
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{
                          __html: getSanitizedHtml(selectedMaterial.fullContent),
                        }}
                      />
                    ) : (
                      <p className="text-foreground">{selectedMaterial?.content}</p>
                    )
                  ) : (
                    <p className="text-muted-foreground">
                      Текст скрыт для удобства чтения. Нажмите «Показать текст», чтобы развернуть статью полностью.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 space-y-6">
                {taxonomyLoading ? (
                  <div className="text-sm text-muted-foreground">Загрузка справочников...</div>
                ) : (
                  <div className="space-y-5">
                    <section className="rounded-lg border bg-muted/30 p-4 space-y-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm font-semibold">Категории</Label>
                          <p className="text-xs text-muted-foreground">
                            Выберите 1–3 наиболее релевантных категории или добавьте новую.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <FilterMultiSelect
                            label="Добавить из списка"
                            options={taxonomy.categories.map((category) => ({
                              value: category.id,
                              label: category.name,
                            }))}
                            selected={pendingTaxonomy.categoryIds}
                            onChange={(values) =>
                              setPendingTaxonomy((prev) => ({ ...prev, categoryIds: values }))
                            }
                            disabled={taxonomy.categories.length === 0}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTaxonomy('categoryIds')}
                            disabled={pendingTaxonomy.categoryIds.length === 0}
                          >
                            Очистить
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
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
                          <span className="text-xs text-muted-foreground">Категории не выбраны</span>
                        )}
                      </div>
                      <div className="space-y-2 border-t pt-4">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Нет нужной категории?
                        </Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={newTaxonomyInputs.category}
                            onChange={handleNewTaxonomyInputChange('category')}
                            placeholder="Название новой категории"
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
                    </section>

                    <div className="grid gap-5 md:grid-cols-2">
                      <section className="rounded-lg border bg-muted/10 p-4 space-y-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <Label className="text-sm font-semibold">Страны</Label>
                              <p className="text-xs text-muted-foreground">
                                Укажите страны, к которым относится материал.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <FilterMultiSelect
                                label="Добавить страну"
                                options={taxonomy.countries.map((country) => ({
                                  value: country.id,
                                  label: country.name,
                                }))}
                                selected={pendingTaxonomy.countryIds}
                                onChange={(values) =>
                                  setPendingTaxonomy((prev) => ({ ...prev, countryIds: values }))
                                }
                                disabled={taxonomy.countries.length === 0}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleClearTaxonomy('countryIds')}
                                disabled={pendingTaxonomy.countryIds.length === 0}
                              >
                                Очистить
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {pendingTaxonomy.countryIds.length > 0 ? (
                              pendingTaxonomy.countryIds.map((id) => {
                                const country = taxonomy.countries.find((item) => item.id === id)
                                if (!country) return null
                                return (
                                  <Badge key={`selected-country-${id}`} variant="secondary" className="gap-1">
                                    {country.name}
                                    <button
                                      type="button"
                                      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:text-destructive"
                                      onClick={() => removeSelection('countryIds', id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                )
                              })
                            ) : (
                              <span className="text-xs text-muted-foreground">Страны не выбраны</span>
                            )}
                          </div>
                          <div className="space-y-2 border-t pt-4">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Добавить новую страну
                            </Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={newTaxonomyInputs.country}
                                onChange={handleNewTaxonomyInputChange('country')}
                                placeholder="Название новой страны"
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
                        </div>
                      </section>

                      <section className="rounded-lg border bg-muted/10 p-4 space-y-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <Label className="text-sm font-semibold">Города</Label>
                              <p className="text-xs text-muted-foreground">
                                Выберите города. Сначала укажите страну — мы подберём связанные города автоматически.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <FilterMultiSelect
                                label="Добавить город"
                                options={filterCityOptions}
                                selected={pendingTaxonomy.cityIds}
                                onChange={(values) =>
                                  setPendingTaxonomy((prev) => ({ ...prev, cityIds: values }))
                                }
                                disabled={filterCityOptions.length === 0}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleClearTaxonomy('cityIds')}
                                disabled={pendingTaxonomy.cityIds.length === 0}
                              >
                                Очистить
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {pendingTaxonomy.cityIds.length > 0 ? (
                              pendingTaxonomy.cityIds.map((id) => {
                                const city = filterCityOptions.find((item) => item.value === id)
                                if (!city) return null
                                return (
                                  <Badge key={`selected-city-${id}`} variant="secondary" className="gap-1">
                                    {city.label}
                                    <button
                                      type="button"
                                      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:text-destructive"
                                      onClick={() => removeSelection('cityIds', id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                )
                              })
                            ) : (
                              <span className="text-xs text-muted-foreground">Города не выбраны</span>
                            )}
                          </div>
                          <div className="space-y-2 border-t pt-4">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Добавить новый город
                            </Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={newTaxonomyInputs.city}
                                onChange={handleNewTaxonomyInputChange('city')}
                                placeholder="Название нового города"
                                className="h-9"
                                disabled={pendingTaxonomy.countryIds.length === 0}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleCreateTaxonomyItem('city')}
                                disabled={pendingTaxonomy.countryIds.length === 0 || creatingTaxonomy === 'city'}
                              >
                                {creatingTaxonomy === 'city' ? 'Добавление...' : 'Добавить'}
                              </Button>
                            </div>
                            {pendingTaxonomy.countryIds.length === 0 && (
                              <p className="text-xs text-muted-foreground">
                                Чтобы добавить город, сначала выберите страну.
                              </p>
                            )}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button 
                  onClick={handleRegenerateTaxonomy} 
                  disabled={regeneratingTaxonomy || taxonomyLoading}
                  variant="outline"
                >
                  {regeneratingTaxonomy ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      Регенерация...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Регенерировать таксономию
                    </>
                  )}
                </Button>
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
