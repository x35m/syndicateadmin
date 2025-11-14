'use client'

import { ChangeEvent, useEffect, useMemo, useState, useCallback, useRef } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
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
  AlertTriangle,
  StopCircle,
  CheckCircle2,
  PauseCircle,
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

const bulkActionMeta: Record<Exclude<BulkAction, null>, { label: string; successMessage: string }> = {
  'generate-summary': {
    label: 'Генерация саммари',
    successMessage: 'Генерация завершена успешно',
  },
  published: {
    label: 'Публикация',
    successMessage: 'Публикация завершена успешно',
  },
  archived: {
    label: 'Архивирование',
    successMessage: 'Архивирование завершено',
  },
  delete: {
    label: 'Удаление',
    successMessage: 'Удаление завершено',
  },
}

type BulkProgressState = {
  action: Exclude<BulkAction, null>
  label: string
  total: number
  completed: number
  success: number
  failed: number
  running: boolean
  stopRequested: boolean
  message: string
  errors: Array<{
    id: string
    title: string
    message: string
  }>
}

type MaterialFiltersState = typeof initialMaterialFilters

interface FilterMultiSelectProps<T extends string | number> {
  label: string
  options: Array<{ value: T; label: string }>
  selected: T[]
  onChange: (values: T[]) => void
  disabled?: boolean
  fullWidth?: boolean
  maxSelected?: number
}

function FilterMultiSelect<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  disabled,
  fullWidth,
  maxSelected,
}: FilterMultiSelectProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const toggleValue = (value: T) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
    } else {
      if (maxSelected && maxSelected > 0) {
        if (maxSelected === 1) {
          onChange([value])
        } else {
          const nextValues = [...selected, value]
          const overflow = nextValues.length - maxSelected
          if (overflow > 0) {
            nextValues.splice(0, overflow)
          }
          onChange(nextValues)
        }
      } else {
        onChange([...selected, value])
      }
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
          className={`${fullWidth ? 'w-full' : 'min-w-[180px]'} justify-between`}
        >
          <span className="flex items-center gap-2 text-sm">
            <span>{label}</span>
            {selected.length > 0 && (
              <Badge variant="secondary" className="px-1 text-xs font-medium">
                {selected.length}
              </Badge>
            )}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={`${fullWidth ? 'w-80' : 'w-64'} max-h-64 overflow-y-auto`}
      >
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
  const [bulkProgress, setBulkProgress] = useState<BulkProgressState | null>(null)
  const bulkStopRequestedRef = useRef(false)
  const [pendingAction, setPendingAction] = useState<BulkAction>(null)
  const [stats, setStats] = useState<MaterialsStats>({ total: 0, new: 0, processed: 0, published: 0, archived: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
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
  const [pendingSummary, setPendingSummary] = useState('')
  const [pendingMetaDescription, setPendingMetaDescription] = useState('')
  const [savingContent, setSavingContent] = useState(false)

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

  const contentChanged = useMemo(() => {
    if (!selectedMaterial) return false
    return (
      pendingSummary !== (selectedMaterial.summary ?? '') ||
      pendingMetaDescription !== (selectedMaterial.metaDescription ?? '')
    )
  }, [selectedMaterial, pendingSummary, pendingMetaDescription])

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
      payload: {
        status?: Material['status']
        processed?: boolean
        published?: boolean
        summary?: string
        metaDescription?: string
      }
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
            if (filter === 'new' && newMaterial.status !== 'new') {
              matches = false
            } else if (filter === 'processed' && newMaterial.status !== 'processed') {
              matches = false
            } else if (filter === 'published' && newMaterial.status !== 'published') {
              matches = false
            } else if (filter === 'archived' && newMaterial.status !== 'archived') {
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
    if (bulkProgress?.running) {
      toast.info('Дождитесь завершения текущего процесса')
      return
    }
    if (selectedIds.size === 0) {
      toast.warning('Выберите материалы для обработки')
      return
    }
    setPendingAction(action)
  }

  const handleStopBulkAction = () => {
    if (!bulkProgress || !bulkProgress.running || bulkProgress.stopRequested) {
      return
    }
    bulkStopRequestedRef.current = true
    setBulkProgress((prev) =>
      prev
        ? {
            ...prev,
            stopRequested: true,
            message: 'Остановка запрошена. Завершаем текущий элемент...'
          }
        : prev
    )
  }

  const handleCloseBulkProgress = () => {
    if (!bulkProgress) return
    if (bulkProgress.running && !bulkProgress.stopRequested) return
    setBulkProgress(null)
    setSelectedIds(new Set())
  }

  const executeBulkAction = useCallback(async () => {
    if (!pendingAction) return

    const action = pendingAction
    const idsArray = Array.from(selectedIds)

    if (idsArray.length === 0) {
      setPendingAction(null)
      toast.warning('Нет выбранных материалов для обработки')
      return
    }

    setPendingAction(null)

    const meta = bulkActionMeta[action]
    setBulkProgress({
      action,
      label: meta.label,
      total: idsArray.length,
      completed: 0,
      success: 0,
      failed: 0,
      running: true,
      stopRequested: false,
      message: 'Запуск...',
      errors: [],
    })
    bulkStopRequestedRef.current = false

    const materialsById = new Map(materials.map((item) => [item.id, item]))
    const errors: BulkProgressState['errors'] = []
        let successCount = 0
    let failedCount = 0
    let completedCount = 0

    const updateProgress = (partial: Partial<BulkProgressState>) => {
      setBulkProgress((prev) => (prev ? { ...prev, ...partial } : prev))
    }

    const updateMetricsMessage = (message: string) => {
      updateProgress({
        completed: completedCount,
        success: successCount,
        failed: failedCount,
        message,
      })
    }

    const processPatch = async (id: string, payload: { status?: Material['status']; published?: boolean }) => {
      await patchMaterial(id, payload)
    }

    try {
      if (action === 'generate-summary') {
        for (const id of idsArray) {
          if (bulkStopRequestedRef.current) {
            updateProgress({
              message: 'Остановка запрошена. Завершаем процесс...',
            })
            break
          }

          const material = materialsById.get(id)
          updateMetricsMessage(`Генерация саммари: ${material?.title ?? id}`)
          
          try {
            const response = await fetch('/api/materials/generate-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ materialId: id }),
            })
            
            const result = await response.json()
            
            if (!response.ok || !result.success) {
              throw new Error(result.error || 'Не удалось сгенерировать саммари')
            }

              successCount++
          } catch (error: any) {
            failedCount++
            errors.push({
              id,
              title: materialsById.get(id)?.title ?? id,
              message: error instanceof Error ? error.message : String(error),
            })
          }

          completedCount++
          updateMetricsMessage(`Обработано ${completedCount}/${idsArray.length}`)
        }

        if (successCount > 0) {
          await fetchTaxonomy()
            }
      } else if (action === 'delete') {
        for (const id of idsArray) {
          if (bulkStopRequestedRef.current) {
            updateProgress({
              message: 'Остановка запрошена. Завершаем процесс...',
            })
            break
          }

          const material = materialsById.get(id)
          updateMetricsMessage(`Удаление: ${material?.title ?? id}`)

          try {
            const response = await fetch(`/api/materials?id=${id}`, {
              method: 'DELETE',
            })
            if (!response.ok) {
              const result = await response.json().catch(() => null)
              throw new Error(result?.error || 'Не удалось удалить материал')
            }
            successCount++
          } catch (error: any) {
            failedCount++
            errors.push({
              id,
              title: material?.title ?? id,
              message: error instanceof Error ? error.message : String(error),
            })
          }

          completedCount++
          updateMetricsMessage(`Обработано ${completedCount}/${idsArray.length}`)
        }
      } else if (action === 'archived') {
        for (const id of idsArray) {
          if (bulkStopRequestedRef.current) {
            updateProgress({
              message: 'Остановка запрошена. Завершаем процесс...',
            })
            break
          }

          const material = materialsById.get(id)
          updateMetricsMessage(`Архивирование: ${material?.title ?? id}`)

          try {
            await processPatch(id, { status: 'archived', published: false })
            successCount++
          } catch (error: any) {
            failedCount++
            errors.push({
              id,
              title: material?.title ?? id,
              message: error instanceof Error ? error.message : String(error),
            })
          }

          completedCount++
          updateMetricsMessage(`Обработано ${completedCount}/${idsArray.length}`)
        }
      } else if (action === 'published') {
        for (const id of idsArray) {
          if (bulkStopRequestedRef.current) {
            updateProgress({
              message: 'Остановка запрошена. Завершаем процесс...',
            })
            break
          }

          const material = materialsById.get(id)
          updateMetricsMessage(`Публикация: ${material?.title ?? id}`)

          if (!material) {
            failedCount++
            errors.push({
              id,
              title: id,
              message: 'Материал не найден в текущем списке',
            })
            completedCount++
            updateMetricsMessage(`Обработано ${completedCount}/${idsArray.length}`)
            continue
          }

          if (!material.summary || material.summary.trim().length === 0) {
            failedCount++
            errors.push({
              id,
              title: material.title,
              message: 'У материала отсутствует саммари, публикация невозможна',
            })
            completedCount++
            updateMetricsMessage(`Обработано ${completedCount}/${idsArray.length}`)
            continue
          }

          try {
            await processPatch(id, { published: true })
            successCount++
          } catch (error: any) {
            failedCount++
            errors.push({
              id,
              title: material.title,
              message: error instanceof Error ? error.message : String(error),
            })
          }

          completedCount++
          updateMetricsMessage(`Обработано ${completedCount}/${idsArray.length}`)
        }
      }
    } catch (error: any) {
      errors.push({
        id: 'system',
        title: 'Системная ошибка',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      if (action === 'generate-summary') {
        await fetchMaterials(filter, currentPage, { silent: true })
      } else {
        await fetchMaterials(filter, currentPage, { silent: true })
      }
      setSelectedIds(new Set())

      const stopRequested = bulkStopRequestedRef.current
      bulkStopRequestedRef.current = false

      const total = idsArray.length
      const finalCompleted = completedCount
      const finalSuccess = successCount
      const finalFailed = failedCount

      let finalMessage = ''
      if (stopRequested && finalCompleted < total) {
        finalMessage = `Процесс остановлен пользователем. Обработано ${finalCompleted} из ${total}.`
      } else if (finalFailed === 0) {
        finalMessage = `${meta.successMessage}. Обработано ${finalSuccess} из ${total}.`
      } else if (finalSuccess === 0) {
        finalMessage = `Не удалось выполнить действие. Ошибок: ${finalFailed}.`
      } else {
        finalMessage = `Выполнено с ошибками: успешно ${finalSuccess}, ошибок ${finalFailed}.`
      }

      updateProgress({
        running: false,
        stopRequested: stopRequested,
        completed: finalCompleted,
        success: finalSuccess,
        failed: finalFailed,
        message: finalMessage,
        errors,
      })

      if (stopRequested && finalCompleted < total) {
        toast(finalMessage)
      } else if (finalFailed === 0) {
        toast.success(finalMessage)
      } else {
        toast.warning(finalMessage)
      }
    }
  }, [pendingAction, selectedIds, materials, filter, currentPage, fetchMaterials, fetchTaxonomy, patchMaterial])

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
      categoryIds: material.categories?.length ? [material.categories[0].id] : [],
      countryIds: material.countries?.map((item) => item.id) ?? [],
      cityIds: material.cities?.map((item) => item.id) ?? [],
    })
    setPendingSummary(material.summary ?? '')
    setPendingMetaDescription(material.metaDescription ?? '')
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
    if (bulkProgress?.running) return
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
    if (bulkProgress?.running) return
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
            categoryIds: [result.data.id],
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

  const handleSaveMaterial = async () => {
    if (!selectedMaterial) return

    try {
      setSavingContent(true)
      setSavingTaxonomy(true)

      const promises: Promise<any>[] = []

      if (contentChanged) {
        promises.push(
          patchMaterial(selectedMaterial.id, {
            summary: pendingSummary,
            metaDescription: pendingMetaDescription,
          })
        )
      }

      promises.push(
        fetch('/api/materials/taxonomy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            materialId: selectedMaterial.id,
            categoryIds: pendingTaxonomy.categoryIds.slice(0, 1),
            countryIds: pendingTaxonomy.countryIds,
            cityIds: pendingTaxonomy.cityIds,
          }),
        }).then(async (response) => {
          const result = await response.json()
          if (!response.ok || !result.success) {
            throw new Error(result.error || 'Не удалось сохранить таксономию')
          }
          return result.data as Material
        })
      )

      const [, updatedMaterial] = await Promise.all(promises)

      if (updatedMaterial) {
        setMaterials((prev) => prev.map((item) => (item.id === updatedMaterial.id ? updatedMaterial : item)))
        setSelectedMaterial({
          ...updatedMaterial,
          summary: pendingSummary,
          metaDescription: pendingMetaDescription,
        })
        setPendingTaxonomy({
          categoryIds: updatedMaterial.categories?.length
            ? [updatedMaterial.categories[0].id]
            : [],
          countryIds: updatedMaterial.countries?.map((item: Country) => item.id) ?? [],
          cityIds: updatedMaterial.cities?.map((item: City) => item.id) ?? [],
        })
      } else {
        setSelectedMaterial((prev) =>
          prev && prev.id === selectedMaterial.id
            ? { ...prev, summary: pendingSummary, metaDescription: pendingMetaDescription }
            : prev
        )
      }

      await fetchMaterials(filter, currentPage, { silent: true })
      toast.success('Материал сохранён')
    } catch (error) {
      console.error('Error saving material:', error)
      toast.error('Не удалось сохранить материал')
    } finally {
      setSavingContent(false)
      setSavingTaxonomy(false)
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
        setPendingSummary(updatedMaterial.summary ?? '')
        setPendingMetaDescription(updatedMaterial.metaDescription ?? '')
        
        // Обновляем pendingTaxonomy с новыми значениями
        setPendingTaxonomy({
          categoryIds: updatedMaterial.categories?.length
            ? [updatedMaterial.categories[0].id]
            : [],
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
          categoryIds: pendingTaxonomy.categoryIds.slice(0, 1),
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
      setPendingSummary(updated.summary ?? '')
      setPendingMetaDescription(updated.metaDescription ?? '')
      setPendingTaxonomy({
        categoryIds: updated.categories?.length ? [updated.categories[0].id] : [],
        countryIds: updated.countries?.map((item: Country) => item.id) ?? [],
        cityIds: updated.cities?.map((item: City) => item.id) ?? [],
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
        return <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">Обработан</Badge>
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
          {bulkProgress ? (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300 w-[min(90vw,600px)]">
              <Card className="border-primary shadow-2xl">
                <CardContent className="py-4 px-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{bulkProgress.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {bulkProgress.message}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Выполнено {bulkProgress.completed} из {bulkProgress.total}. Успешно {bulkProgress.success}, ошибок {bulkProgress.failed}.
                      </p>
                    </div>
                    <div className="flex items-center justify-center rounded-full border bg-background p-2">
                      {bulkProgress.running ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : bulkProgress.failed > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{
                        width: `${bulkProgress.total > 0 ? Math.min(100, Math.round((bulkProgress.completed / bulkProgress.total) * 100)) : 0}%`,
                      }}
                    />
                  </div>

                  {bulkProgress.errors.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-3 text-xs">
                      <p className="mb-2 font-semibold text-foreground">Ошибки:</p>
                      <div className="space-y-2">
                        {bulkProgress.errors.map((error) => (
                          <div key={`${error.id}-${error.message}`} className="space-y-1">
                            <p className="font-medium text-foreground break-words">{error.title}</p>
                            <p className="text-muted-foreground break-words">{error.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStopBulkAction}
                      disabled={!bulkProgress.running || bulkProgress.stopRequested}
                      className="flex items-center gap-2"
                    >
                      {bulkProgress.stopRequested ? (
                        <>
                          <PauseCircle className="h-4 w-4" />
                          Остановка...
                        </>
                      ) : bulkProgress.running ? (
                        <>
                          <StopCircle className="h-4 w-4" />
                          Остановить
                        </>
                      ) : (
                        <>
                          <StopCircle className="h-4 w-4" />
                          Остановлено
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCloseBulkProgress}
                      disabled={bulkProgress.running}
                    >
                      Закрыть
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            selectedIds.size > 0 && (
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
            )
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
                      label: item.isHidden ? `${item.name} (скрыта)` : item.name,
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
                          disabled={!!bulkProgress?.running}
                        />
                      </TableHead>
                      <TableHead className="w-20">Обложка</TableHead>
                      <TableHead className="min-w-[300px]">Заголовок</TableHead>
                      <TableHead className="w-[220px]">Категории</TableHead>
                      <TableHead>Источник</TableHead>
                      <TableHead className="w-[130px]">Дата</TableHead>
                      <TableHead className="w-[140px]">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkProgress?.running ? (
                      Array.from({
                        length: Math.min(
                          paginatedMaterials.length || pageSize,
                          pageSize
                        ),
                      }).map((_, index) => (
                        <TableRow key={`bulk-skeleton-${index}`}>
                          <TableCell>
                            <Skeleton className="h-4 w-4 rounded" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-16 w-16 rounded" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="mt-2 h-4 w-64" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-40" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-28" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      paginatedMaterials.map((material) => (
                      <TableRow key={material.id} className="cursor-pointer hover:bg-accent/50">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(material.id)}
                            onCheckedChange={() => toggleSelect(material.id)}
                              disabled={!!bulkProgress?.running}
                          />
                        </TableCell>
                          <TableCell onClick={() => !bulkProgress?.running && openMaterialDialog(material)}>
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
                          <TableCell className="font-medium" onClick={() => !bulkProgress?.running && openMaterialDialog(material)}>
                          <div className="line-clamp-3 leading-snug">
                            {material.title}
                          </div>
                        </TableCell>
                          <TableCell onClick={() => !bulkProgress?.running && openMaterialDialog(material)}>
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
                          <TableCell onClick={() => !bulkProgress?.running && openMaterialDialog(material)}>
                          <div className="truncate max-w-[200px]" title={material.feedName || material.source}>
                            {material.feedName || material.source || '—'}
                          </div>
                        </TableCell>
                          <TableCell onClick={() => !bulkProgress?.running && openMaterialDialog(material)}>{formatDate(material.createdAt)}</TableCell>
                          <TableCell onClick={() => !bulkProgress?.running && openMaterialDialog(material)}>
                            {getStatusBadge(material.status)}
                          </TableCell>
                      </TableRow>
                      ))
                    )}
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
                  disabled={bulkProgress?.running === true}
                  className={`${dialogContent?.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}`}
                >
                  {dialogContent?.actionText}
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
                  <div className="flex flex-wrap gap-4 text-sm">
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
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Мета описание
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {pendingMetaDescription.length}/160
                    </span>
                </div>
                  <Textarea
                    value={pendingMetaDescription}
                    onChange={(event) => setPendingMetaDescription(event.target.value)}
                    maxLength={160}
                    rows={3}
                    placeholder="Краткое описание статьи"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Саммари
                    </span>
                    {selectedMaterial?.summary && <Badge variant="secondary">AI</Badge>}
                  </div>
                  <Textarea
                    value={pendingSummary}
                    onChange={(event) => setPendingSummary(event.target.value)}
                    rows={6}
                    placeholder="Краткое саммари на 3-5 предложений"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Категории публикации
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pendingTaxonomy.categoryIds.length > 0 ? (
                      pendingTaxonomy.categoryIds
                        .map((id) => taxonomy.categories.find((category) => category.id === id))
                        .filter((category): category is Category => Boolean(category))
                        .map((category) => (
                          <Badge
                            key={`pub-category-${category.id}`}
                            variant={category.isHidden ? 'outline' : 'secondary'}
                            className="gap-1"
                          >
                            {category.name}
                            {category.isHidden && (
                              <span className="ml-1 rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">
                                скрыта
                              </span>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 text-muted-foreground hover:text-destructive"
                              onClick={() => removeSelection('categoryIds', category.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        У материала нет выбранных категорий
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFullContent((prev) => !prev)}
                  className="w-full sm:w-56"
                >
                  {showFullContent ? 'Скрыть полный текст' : 'Показать полный текст'}
                </Button>
                {showFullContent && (
                  <div className="rounded-lg border bg-background p-4 text-sm leading-relaxed">
                {selectedMaterial?.fullContent ? (
                  <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ 
                          __html: getSanitizedHtml(selectedMaterial.fullContent),
                    }}
                  />
                ) : (
                      <p className="text-foreground">{selectedMaterial?.content}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-6 space-y-6">
                {taxonomyLoading ? (
                  <div className="text-sm text-muted-foreground">Загрузка справочников...</div>
                ) : (
                  <div className="space-y-5">
                    <section className="rounded-lg border bg-muted/30 p-4 space-y-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Категории</Label>
                        <p className="text-xs text-muted-foreground">
                          Выберите 1–3 наиболее релевантных категории или добавьте новую.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <FilterMultiSelect
                          label="Добавить из списка"
                          options={taxonomy.categories.map((category) => ({
                            value: category.id,
                            label: category.isHidden ? `${category.name} (скрыта)` : category.name,
                          }))}
                          selected={pendingTaxonomy.categoryIds}
                          onChange={(values) =>
                            setPendingTaxonomy((prev) => ({ ...prev, categoryIds: values }))
                          }
                          disabled={taxonomy.categories.length === 0}
                          fullWidth
                        maxSelected={1}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClearTaxonomy('categoryIds')}
                          disabled={pendingTaxonomy.categoryIds.length === 0}
                          className="sm:w-auto w-full"
                        >
                          Очистить
                        </Button>
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

                    <div className="space-y-5">
                      <section className="rounded-lg border bg-muted/10 p-4 space-y-4">
                        <div className="space-y-1">
                          <Label className="text-sm font-semibold">Страны</Label>
                          <p className="text-xs text-muted-foreground">
                            Укажите страны, к которым относится материал.
                          </p>
                      </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
                            fullWidth
                        />
                        <Button
                            variant="ghost"
                          size="sm"
                            onClick={() => handleClearTaxonomy('countryIds')}
                            disabled={pendingTaxonomy.countryIds.length === 0}
                            className="sm:w-auto w-full"
                        >
                            Очистить
                        </Button>
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
                      </section>

                      <section className="rounded-lg border bg-muted/10 p-4 space-y-4">
                        <div className="space-y-1">
                          <Label className="text-sm font-semibold">Города</Label>
                          <p className="text-xs text-muted-foreground">
                            Выберите города. Сначала укажите страну — мы подберём связанные города автоматически.
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <FilterMultiSelect
                            label="Добавить город"
                            options={filterCityOptions}
                            selected={pendingTaxonomy.cityIds}
                            onChange={(values) =>
                              setPendingTaxonomy((prev) => ({ ...prev, cityIds: values }))
                            }
                            disabled={filterCityOptions.length === 0}
                            fullWidth
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTaxonomy('cityIds')}
                            disabled={pendingTaxonomy.cityIds.length === 0}
                            className="sm:w-auto w-full"
                          >
                            Очистить
                          </Button>
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
                      </section>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col items-end gap-2">
                <Button
                  onClick={handleRegenerateTaxonomy}
                  disabled={regeneratingTaxonomy || taxonomyLoading}
                  variant="outline"
                  className="w-full sm:w-56"
                >
                  {regeneratingTaxonomy ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                      Регенерация...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Регенерировать таксономию
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSaveMaterial}
                  disabled={savingContent || savingTaxonomy || taxonomyLoading}
                  className="w-full sm:w-56"
                >
                  {savingContent || savingTaxonomy ? 'Сохранение...' : 'Сохранить'}
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
