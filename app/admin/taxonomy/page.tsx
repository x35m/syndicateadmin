'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Category, City, Country } from '@/lib/types'
import {
  MoreHorizontal,
  PencilLine,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react'

type SimpleKind = 'categories'
type TaxonomyKind = SimpleKind | 'countries' | 'cities'
type ApiType = 'category' | 'country' | 'city'
type PromptType = 'category' | 'country' | 'city'

interface CountryWithRelations extends Country {
  cities: City[]
}

interface CityRow extends City {
  countryName: string
}

interface TaxonomyState {
  categories: Category[]
  countries: CountryWithRelations[]
}

const defaultState: TaxonomyState = {
  categories: [],
  countries: [],
}

const TAB_CONFIG: Record<TaxonomyKind, { label: string; type: ApiType }> = {
  categories: { label: 'Категории', type: 'category' },
  countries: { label: 'Страны', type: 'country' },
  cities: { label: 'Города', type: 'city' },
}

const PROMPT_LABELS: Record<PromptType, string> = {
  category: 'Промпт категорий',
  country: 'Промпт стран',
  city: 'Промпт городов',
}

type ModalState =
  | null
  | {
      mode: 'create' | 'edit'
      type: ApiType
      id?: number
      name: string
      countryId?: number | null
    }

type PromptModalState = {
  type: PromptType
  value: string
} | null

export default function TaxonomyPage() {
  const [activeTab, setActiveTab] = useState<TaxonomyKind>('categories')
  const [taxonomy, setTaxonomy] = useState<TaxonomyState>(defaultState)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [savingItem, setSavingItem] = useState(false)
  const [promptModal, setPromptModal] = useState<PromptModalState>(null)
  const [prompts, setPrompts] = useState<Record<PromptType, string>>({
    category: '',
    country: '',
    city: '',
  })
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [search, setSearch] = useState<Record<TaxonomyKind, string>>({
    categories: '',
    countries: '',
    cities: '',
  })
  const [selectedIds, setSelectedIds] = useState<
    Record<TaxonomyKind, Set<number>>
  >({
    categories: new Set(),
    countries: new Set(),
    cities: new Set(),
  })
  const [togglingCategories, setTogglingCategories] = useState<Set<number>>(
    () => new Set()
  )

  const cityRows: CityRow[] = useMemo(() => {
    return taxonomy.countries.flatMap((country) =>
      country.cities.map((city) => ({
        ...city,
        countryName: country.name,
      }))
    )
  }, [taxonomy.countries])

  const fetchTaxonomy = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/taxonomy')
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Не удалось получить данные таксономии')
        return
      }
        setTaxonomy({
          categories: result.categories ?? [],
          countries: (result.countries ?? []) as CountryWithRelations[],
        })
    } catch (error) {
      console.error('Error fetching taxonomy:', error)
      toast.error('Не удалось получить данные таксономии')
    } finally {
      setLoading(false)
    }
  }

  const fetchPrompts = async () => {
    try {
      setLoadingPrompts(true)
      const response = await fetch('/api/taxonomy/prompts')
      const result = await response.json()
      if (result.success && result.data) {
        setPrompts(result.data)
      }
    } catch (error) {
      console.error('Error fetching taxonomy prompts:', error)
      toast.error('Не удалось загрузить системные промпты')
    } finally {
      setLoadingPrompts(false)
    }
  }

  const toggleCategoryVisibility = async (
    categoryId: number,
    nextHidden: boolean
  ) => {
    setTogglingCategories((prev) => {
      const next = new Set(prev)
      next.add(categoryId)
      return next
    })

    try {
      const response = await fetch('/api/taxonomy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          id: categoryId,
          isHidden: nextHidden,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        toast.error(result.error || 'Не удалось обновить категорию')
        return
      }

      await fetchTaxonomy()
      toast.success(
        nextHidden
          ? 'Категория скрыта из публичного раздела'
          : 'Категория снова видна в публичном разделе'
      )
    } catch (error) {
      console.error('Error toggling category visibility:', error)
      toast.error('Не удалось изменить видимость категории')
    } finally {
      setTogglingCategories((prev) => {
        const next = new Set(prev)
        next.delete(categoryId)
        return next
      })
    }
  }

  useEffect(() => {
    fetchTaxonomy()
    fetchPrompts()
  }, [])

  const handleSelectionToggle = (tab: TaxonomyKind, id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev[tab])
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { ...prev, [tab]: next }
    })
  }

  const handleToggleAll = (tab: TaxonomyKind, ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev[tab])
      const allSelected = ids.every((id) => next.has(id))
      if (allSelected) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return { ...prev, [tab]: next }
    })
  }

  const resetSelection = (tab: TaxonomyKind) => {
    setSelectedIds((prev) => ({ ...prev, [tab]: new Set() }))
  }

  const openCreateModal = (tab: TaxonomyKind) => {
    const type = TAB_CONFIG[tab].type
    setModal({
      mode: 'create',
      type,
      name: '',
      countryId: type === 'city' ? null : undefined,
    })
  }

  const openEditModal = (
    tab: TaxonomyKind,
    id: number,
    name: string,
    countryId?: number | null
  ) => {
    const type = TAB_CONFIG[tab].type
    setModal({
      mode: 'edit',
      type,
      id,
      name,
      countryId: type === 'city' ? countryId ?? null : undefined,
    })
  }

  const handleSaveItem = async () => {
    if (!modal) return
    const { mode, type, name, id, countryId } = modal
    const trimmedName = name.trim()

    if (!trimmedName) {
      toast.warning('Название не может быть пустым')
      return
    }

    if (type === 'city' && !countryId) {
      toast.warning('Выберите страну для города')
      return
    }

    try {
      setSavingItem(true)
      if (mode === 'create') {
      const response = await fetch('/api/taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
            name: trimmedName,
            countryId: type === 'city' ? countryId : undefined,
        }),
      })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Не удалось создать элемент')
        return
      }
        toast.success('Элемент создан')
      } else if (id !== undefined) {
        const response = await fetch('/api/taxonomy', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            id,
            name: trimmedName,
            countryId: type === 'city' ? countryId : undefined,
          }),
        })
        const result = await response.json()
        if (!response.ok || !result.success) {
          toast.error(result.error || 'Не удалось обновить элемент')
          return
        }
        toast.success('Элемент обновлён')
      }
      await fetchTaxonomy()
      setModal(null)
    } catch (error) {
      console.error('Error saving taxonomy item:', error)
      toast.error('Не удалось сохранить элемент')
    } finally {
      setSavingItem(false)
    }
  }

  const deleteItem = async (type: ApiType, id: number) => {
    try {
      const response = await fetch(`/api/taxonomy?type=${type}&id=${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        toast.error(result.error || 'Не удалось удалить элемент')
        return false
      }
      return true
    } catch (error) {
      console.error('Error deleting taxonomy item:', error)
      toast.error('Не удалось удалить элемент')
      return false
    }
  }

  const handleBulkDelete = async (tab: TaxonomyKind) => {
    const ids = Array.from(selectedIds[tab])
    if (ids.length === 0) return

    const confirmMessage =
      tab === 'countries'
        ? 'Удалить выбранные страны? Все связанные города будут удалены.'
        : tab === 'cities'
        ? 'Удалить выбранные города?'
        : 'Удалить выбранные элементы?'

    if (!window.confirm(confirmMessage)) {
      return
    }

    const type = TAB_CONFIG[tab].type
    for (const id of ids) {
      const success = await deleteItem(type, id)
      if (!success) break
    }
    await fetchTaxonomy()
    resetSelection(tab)
    toast.success('Удаление выполнено')
  }

  const openPromptDialog = (tab: TaxonomyKind) => {
    const type = TAB_CONFIG[tab].type as PromptType
    setPromptModal({
      type,
      value: prompts[type] ?? '',
    })
  }

  const handleSavePrompt = async () => {
    if (!promptModal) return
    const { type, value } = promptModal
    const trimmed = value.trim()
    if (!trimmed) {
      toast.warning('Промпт не может быть пустым')
      return
    }
    try {
      setSavingPrompt(true)
      const response = await fetch('/api/taxonomy/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, prompt: trimmed }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        toast.error(result.error || 'Не удалось сохранить промпт')
        return
      }
      setPrompts((prev) => ({ ...prev, [type]: trimmed }))
      toast.success('Промпт обновлён')
      setPromptModal(null)
    } catch (error) {
      console.error('Error saving taxonomy prompt:', error)
      toast.error('Не удалось сохранить промпт')
    } finally {
      setSavingPrompt(false)
    }
  }

  const filteredSimpleItems = (tab: SimpleKind): Category[] => {
    const query = search[tab].toLowerCase()
    const items = taxonomy[tab] as Category[]
    if (!query) return items
    return items.filter((item) => item.name.toLowerCase().includes(query))
  }

  const filteredCountries = useMemo(() => {
    const query = search.countries.toLowerCase()
    if (!query) return taxonomy.countries
    return taxonomy.countries.filter((country) =>
      country.name.toLowerCase().includes(query)
    )
  }, [taxonomy.countries, search.countries])

  const filteredCities = useMemo(() => {
    const query = search.cities.toLowerCase()
    if (!query) return cityRows
    return cityRows.filter(
      (city) =>
        city.name.toLowerCase().includes(query) ||
        city.countryName.toLowerCase().includes(query)
    )
  }, [cityRows, search.cities])

  const activeSelectionCount = selectedIds[activeTab].size

  const renderSimpleTable = (tab: SimpleKind) => {
    const items = filteredSimpleItems(tab)
    const allIds = items.map((item) => item.id)
    const selection = selectedIds[tab]
    const type = TAB_CONFIG[tab].type

  return (
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{TAB_CONFIG[tab].label}</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Используйте таблицу для просмотра, редактирования и массового удаления.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Поиск..."
                value={search[tab]}
                onChange={(event) =>
                  setSearch((prev) => ({ ...prev, [tab]: event.target.value }))
                }
                className="h-9 w-full sm:w-48"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => openPromptDialog(tab)}
                disabled={loadingPrompts}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Системный промпт
              </Button>
            </div>
            <Button size="sm" onClick={() => openCreateModal(tab)}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Элементы не найдены.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        items.length > 0 && allIds.every((id) => selection.has(id))
                      }
                      onCheckedChange={() => handleToggleAll(tab, allIds)}
                    />
                  </TableHead>
                  <TableHead>Название</TableHead>
                  {tab === 'categories' && (
                    <TableHead className="w-40 text-center">Видимость</TableHead>
                  )}
                  <TableHead className="w-16 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selection.has(item.id)}
                        onCheckedChange={() => handleSelectionToggle(tab, item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    {tab === 'categories' && (
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Badge variant={item.isHidden ? 'outline' : 'default'}>
                            {item.isHidden ? 'Скрыта' : 'Видна'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toggleCategoryVisibility(item.id, !item.isHidden)
                            }
                            disabled={togglingCategories.has(item.id)}
                          >
                            {togglingCategories.has(item.id)
                              ? 'Сохранение...'
                              : item.isHidden
                              ? 'Показать'
                              : 'Скрыть'}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              openEditModal(tab, item.id, item.name)
                            }
                          >
                            <PencilLine className="mr-2 h-4 w-4" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const confirmed = window.confirm(
                                'Удалить элемент?'
                              )
                              if (!confirmed) return
                              const success = await deleteItem(type, item.id)
                              if (success) {
                                toast.success('Элемент удалён')
                                await fetchTaxonomy()
                              }
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
                </CardContent>
              </Card>
    )
  }

  const renderCountriesTable = () => {
    const tab: TaxonomyKind = 'countries'
    const items = filteredCountries
    const selection = selectedIds[tab]
    const allIds = items.map((country) => country.id)

    return (
              <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Страны</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Управляйте списком стран и связанных городов.
            </p>
                  </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
                    <Input
                placeholder="Поиск страны..."
                value={search.countries}
                onChange={(event) =>
                  setSearch((prev) => ({ ...prev, countries: event.target.value }))
                }
                className="h-9 w-full sm:w-56"
                    />
                    <Button
                variant="outline"
                      size="sm"
                onClick={() => openPromptDialog('countries')}
                disabled={loadingPrompts}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Системный промпт
              </Button>
            </div>
            <Button size="sm" onClick={() => openCreateModal('countries')}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить страну
                    </Button>
                  </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Страны не найдены.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        items.length > 0 && allIds.every((id) => selection.has(id))
                      }
                      onCheckedChange={() => handleToggleAll(tab, allIds)}
                    />
                  </TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="w-24 text-right">Городов</TableHead>
                  <TableHead className="w-16 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((country) => (
                  <TableRow key={country.id}>
                    <TableCell>
                      <Checkbox
                        checked={selection.has(country.id)}
                        onCheckedChange={() =>
                          handleSelectionToggle(tab, country.id)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{country.name}</TableCell>
                    <TableCell className="text-right">
                      {country.cities.length}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              openEditModal('countries', country.id, country.name)
                            }
                          >
                            <PencilLine className="mr-2 h-4 w-4" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const confirmed = window.confirm(
                                'Удалить страну и все связанные города?'
                              )
                              if (!confirmed) return
                              const success = await deleteItem('country', country.id)
                              if (success) {
                                toast.success('Страна удалена')
                                await fetchTaxonomy()
                              }
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
                </CardContent>
              </Card>
    )
  }

  const renderCitiesTable = () => {
    const tab: TaxonomyKind = 'cities'
    const items = filteredCities
    const selection = selectedIds[tab]
    const allIds = items.map((city) => city.id)

    return (
              <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Города</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Управляйте списком городов и их принадлежностью к странам.
            </p>
                  </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
                    <Input
                placeholder="Поиск города или страны..."
                value={search.cities}
                onChange={(event) =>
                  setSearch((prev) => ({ ...prev, cities: event.target.value }))
                }
                className="h-9 w-full sm:w-64"
                    />
                    <Button
                variant="outline"
                      size="sm"
                onClick={() => openPromptDialog('cities')}
                disabled={loadingPrompts}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Системный промпт
              </Button>
            </div>
            <Button size="sm" onClick={() => openCreateModal('cities')}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить город
                    </Button>
                  </div>
                </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
                              ))}
                            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Города не найдены.
                        </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        items.length > 0 && allIds.every((id) => selection.has(id))
                      }
                      onCheckedChange={() => handleToggleAll(tab, allIds)}
                    />
                  </TableHead>
                  <TableHead>Город</TableHead>
                  <TableHead>Страна</TableHead>
                  <TableHead className="w-16 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((city) => (
                  <TableRow key={city.id}>
                    <TableCell>
                      <Checkbox
                        checked={selection.has(city.id)}
                        onCheckedChange={() =>
                          handleSelectionToggle(tab, city.id)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{city.name}</TableCell>
                    <TableCell>{city.countryName}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              openEditModal(
                                'cities',
                                city.id,
                                city.name,
                                city.countryId
                              )
                            }
                          >
                            <PencilLine className="mr-2 h-4 w-4" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const confirmed = window.confirm('Удалить город?')
                              if (!confirmed) return
                              const success = await deleteItem('city', city.id)
                              if (success) {
                                toast.success('Город удалён')
                                await fetchTaxonomy()
                              }
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Справочники</h1>
            <p className="text-muted-foreground max-w-2xl">
              Управляйте таксономиями материалов, настраивайте системные промпты для
              нейросети и выполняйте массовые операции над элементами.
            </p>
                  </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TaxonomyKind)}>
            <TabsList className="flex-wrap">
              {(
                Object.keys(TAB_CONFIG) as TaxonomyKind[]
              ).map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {TAB_CONFIG[tab].label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="categories">{renderSimpleTable('categories')}</TabsContent>
            <TabsContent value="countries">{renderCountriesTable()}</TabsContent>
            <TabsContent value="cities">{renderCitiesTable()}</TabsContent>
          </Tabs>
                      </div>
                    </div>

      {/* Item Modal */}
      <Dialog open={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modal?.mode === 'create' ? 'Создать элемент' : 'Редактировать элемент'}
            </DialogTitle>
            <DialogDescription>
              {modal
                ? `Тип: ${TAB_CONFIG[
                    (Object.keys(TAB_CONFIG) as TaxonomyKind[]).find(
                      (tab) => TAB_CONFIG[tab].type === modal.type
                    ) ?? 'categories'
                  ].label}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {modal && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="taxonomy-name">Название</Label>
                <Input
                  id="taxonomy-name"
                  value={modal.name}
                  onChange={(event) =>
                    setModal((prev) =>
                      prev ? { ...prev, name: event.target.value } : prev
                    )
                  }
                  autoFocus
                />
              </div>
              {modal.type === 'city' && (
                    <div className="space-y-2">
                  <Label htmlFor="taxonomy-country">Страна</Label>
                      <select
                    id="taxonomy-country"
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={modal.countryId ?? ''}
                    onChange={(event) =>
                      setModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              countryId: event.target.value
                                ? Number(event.target.value)
                                : null,
                            }
                          : prev
                      )
                    }
                      >
                        <option value="">Выберите страну</option>
                        {taxonomy.countries.map((country) => (
                          <option key={country.id} value={country.id}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)} disabled={savingItem}>
              Отмена
            </Button>
            <Button onClick={handleSaveItem} disabled={savingItem}>
              {savingItem ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt Modal */}
      <Dialog open={promptModal !== null} onOpenChange={(open) => !open && setPromptModal(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {promptModal ? PROMPT_LABELS[promptModal.type] : 'Системный промпт'}
            </DialogTitle>
            <DialogDescription>
              Опишите правила для нейросети при назначении значений этого справочника.
            </DialogDescription>
          </DialogHeader>
          {promptModal && (
            <Textarea
              rows={8}
              value={promptModal.value}
              onChange={(event) =>
                setPromptModal((prev) =>
                  prev ? { ...prev, value: event.target.value } : prev
                )
              }
              className="resize-none"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptModal(null)} disabled={savingPrompt}>
              Отмена
            </Button>
            <Button onClick={handleSavePrompt} disabled={savingPrompt}>
              {savingPrompt ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Actions */}
      {activeSelectionCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <Card className="border-primary shadow-xl">
            <CardContent className="flex items-center gap-4 py-3 px-6">
              <span className="text-sm">
                Выбрано:{' '}
                <span className="font-semibold text-primary">
                  {activeSelectionCount}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkDelete(activeTab)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </Button>
                        <Button
                  variant="ghost"
                          size="sm"
                  onClick={() => resetSelection(activeTab)}
                        >
                  Сбросить
                        </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
    </>
  )
}

