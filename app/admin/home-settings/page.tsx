'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface SourceOption {
  name: string
  count: number
}

interface CountedOption {
  id: number
  name: string
  count: number
}

interface HomeSettingsResponse {
  success: boolean
  data: {
    sources: string[]
    categories: number[]
    countries: number[]
  }
  options: {
    sources: SourceOption[]
    categories: CountedOption[]
    countries: CountedOption[]
  }
}

export default function HomeSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState<{
    sources: string[]
    categories: number[]
    countries: number[]
  }>({ sources: [], categories: [], countries: [] })
  const [initialFilters, setInitialFilters] = useState<typeof filters | null>(null)
  const [options, setOptions] = useState<HomeSettingsResponse['options']>({
    sources: [],
    categories: [],
    countries: [],
  })

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/public/home-settings', { cache: 'no-store' })
        const result: HomeSettingsResponse = await response.json()

        if (!response.ok || result.success === false) {
          throw new Error(result?.data ? 'Не удалось загрузить настройки' : result.error)
        }

        setFilters(result.data)
        setInitialFilters(result.data)
        setOptions(result.options)
      } catch (error) {
        console.error('Failed to fetch home settings:', error)
        toast.error('Не удалось загрузить настройки главной страницы')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const isDirty = useMemo(() => {
    if (!initialFilters) return false
    return (
      JSON.stringify(filters.sources.sort()) !== JSON.stringify(initialFilters.sources.slice().sort()) ||
      JSON.stringify(filters.categories.sort()) !== JSON.stringify(initialFilters.categories.slice().sort()) ||
      JSON.stringify(filters.countries.sort()) !== JSON.stringify(initialFilters.countries.slice().sort())
    )
  }, [filters, initialFilters])

  const toggleSource = (name: string) => {
    setFilters((prev) => {
      const exists = prev.sources.includes(name)
      return {
        ...prev,
        sources: exists ? prev.sources.filter((item) => item !== name) : [...prev.sources, name],
      }
    })
  }

  const toggleCategory = (id: number) => {
    setFilters((prev) => {
      const exists = prev.categories.includes(id)
      return {
        ...prev,
        categories: exists ? prev.categories.filter((item) => item !== id) : [...prev.categories, id],
      }
    })
  }

  const toggleCountry = (id: number) => {
    setFilters((prev) => {
      const exists = prev.countries.includes(id)
      return {
        ...prev,
        countries: exists ? prev.countries.filter((item) => item !== id) : [...prev.countries, id],
      }
    })
  }

  const resetChanges = () => {
    if (initialFilters) {
      setFilters(initialFilters)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/public/home-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      })

      const result = await response.json()
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Не удалось сохранить настройки')
      }

      toast.success('Настройки главной страницы сохранены')
      setInitialFilters(filters)
    } catch (error) {
      console.error('Error saving home settings:', error)
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить настройки')
    } finally {
      setSaving(false)
    }
  }

  const renderSection = ({
    title,
    description,
    options,
    selected,
    onToggle,
  }: {
    title: string
    description: string
    options: Array<SourceOption | CountedOption>
    selected: Array<string | number>
    onToggle: (value: any) => void
  }) => (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold uppercase text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {options.length === 0 ? (
        <div className="text-xs text-muted-foreground">Нет доступных данных</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const hasId = Object.prototype.hasOwnProperty.call(option, 'id')
            const value = hasId ? (option as CountedOption).id : (option as SourceOption).name
            const label = option.name
            const count = option.count
            const isActive = selected.includes(value)
            return (
              <Button
                key={`${title}-${value}`}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => onToggle(value)}
              >
                <span>{label}</span>
                <Badge variant={isActive ? 'secondary' : 'outline'} className="text-xs">
                  {count}
                </Badge>
              </Button>
            )
          })}
        </div>
      )}
    </section>
  )

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Настройки главной страницы</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Выберите источники, регионы и категории, которые разрешено показывать на публичной главной
              странице. Настройки применяются ко всем посетителям.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Фильтры публикации</CardTitle>
              <CardDescription>
                Материалы, не соответствующие выбранным критериям, не будут отображаться на публичной
                главной странице.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 4 }).map((__, i) => (
                          <Skeleton key={i} className="h-9 w-32" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {renderSection({
                    title: 'Источники',
                    description: 'Выберите один или несколько источников, которые могут появляться на главной.',
                    options: options.sources,
                    selected: filters.sources,
                    onToggle: toggleSource,
                  })}
                  {renderSection({
                    title: 'Регионы',
                    description: 'Материалы без выбранных стран не будут отображаться.',
                    options: options.countries,
                    selected: filters.countries,
                    onToggle: toggleCountry,
                  })}
                  {renderSection({
                    title: 'Категории',
                    description: 'Выберите категории, которые должны присутствовать у материала.',
                    options: options.categories,
                    selected: filters.categories,
                    onToggle: toggleCategory,
                  })}

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleSave} disabled={!isDirty || saving}>
                      {saving ? 'Сохранение...' : 'Сохранить настройки'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetChanges}
                      disabled={!isDirty || saving}
                    >
                      Сбросить изменения
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

