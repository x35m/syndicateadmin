'use client'

import { useEffect, useState, ChangeEvent } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Category, Theme, Tag, Country, City } from '@/lib/types'

type CountryWithCities = Country & { cities: City[] }

type TaxonomyType = 'category' | 'theme' | 'tag' | 'country' | 'city'

type TaxonomyState = {
  categories: Category[]
  themes: Theme[]
  tags: Tag[]
  countries: CountryWithCities[]
}

const defaultState: TaxonomyState = {
  categories: [],
  themes: [],
  tags: [],
  countries: [],
}

export default function TaxonomyPage() {
  const [taxonomy, setTaxonomy] = useState<TaxonomyState>(defaultState)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<null | TaxonomyType>(null)
  const [newValues, setNewValues] = useState({
    category: '',
    theme: '',
    tag: '',
    country: '',
    city: '',
    cityCountryId: '',
  })

  const fetchTaxonomy = async () => {
    try {
      setLoading(true)
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
        toast.error(result.error || 'Не удалось получить данные')
      }
    } catch (error) {
      console.error('Error fetching taxonomy:', error)
      toast.error('Не удалось получить данные')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTaxonomy()
  }, [])

  const handleChange = (key: keyof typeof newValues) => (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLSelectElement>) => {
    setNewValues((prev) => ({
      ...prev,
      [key]: event.target.value,
    }))
  }

  const handleCreate = async (type: TaxonomyType) => {
    const valueKey = type === 'city' ? 'city' : type
    const value = newValues[valueKey]

    if (!value.trim()) {
      toast.warning('Введите название')
      return
    }

    if (type === 'city' && !newValues.cityCountryId) {
      toast.warning('Выберите страну для нового города')
      return
    }

    try {
      setCreating(type)
      const response = await fetch('/api/taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: value,
          countryId: type === 'city' ? Number(newValues.cityCountryId) : undefined,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Не удалось создать элемент')
        return
      }

      await fetchTaxonomy()
      toast.success('Элемент добавлен')
 
       setNewValues((prev) => ({
         ...prev,
         [valueKey]: '',
       }))
    } catch (error) {
      console.error('Error creating taxonomy item:', error)
      toast.error('Не удалось создать элемент')
    } finally {
      setCreating(null)
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Справочники материала</h1>
            <p className="text-muted-foreground mt-2">
              Управление категориями, темами, тегами, странами и городами, которые можно привязывать к материалам.
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Категории</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {taxonomy.categories.length > 0 ? (
                      taxonomy.categories.map((category) => (
                        <Badge key={category.id} variant="secondary" className="text-xs font-medium">
                          {category.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Список пуст</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={newValues.category}
                      onChange={handleChange('category')}
                      placeholder="Новая категория"
                      className="h-9"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleCreate('category')}
                      disabled={creating === 'category'}
                    >
                      {creating === 'category' ? 'Добавление...' : 'Добавить'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Темы</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {taxonomy.themes.length > 0 ? (
                      taxonomy.themes.map((theme) => (
                        <Badge key={theme.id} variant="secondary" className="text-xs font-medium">
                          {theme.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Список пуст</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={newValues.theme}
                      onChange={handleChange('theme')}
                      placeholder="Новая тема"
                      className="h-9"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleCreate('theme')}
                      disabled={creating === 'theme'}
                    >
                      {creating === 'theme' ? 'Добавление...' : 'Добавить'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Теги</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {taxonomy.tags.length > 0 ? (
                      taxonomy.tags.map((tag) => (
                        <Badge key={tag.id} variant="secondary" className="text-xs font-medium">
                          {tag.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Список пуст</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={newValues.tag}
                      onChange={handleChange('tag')}
                      placeholder="Новый тег"
                      className="h-9"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleCreate('tag')}
                      disabled={creating === 'tag'}
                    >
                      {creating === 'tag' ? 'Добавление...' : 'Добавить'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Страны и города</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {taxonomy.countries.length > 0 ? (
                      taxonomy.countries.map((country) => (
                        <div key={country.id} className="rounded-md border p-3">
                          <div className="font-medium text-sm">{country.name}</div>
                          {country.cities.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {country.cities.map((city) => (
                                <Badge key={city.id} variant="outline" className="text-xs font-normal">
                                  {city.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-muted-foreground">Города не добавлены</div>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Список стран пуст</span>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Добавить страну</Label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={newValues.country}
                          onChange={handleChange('country')}
                          placeholder="Название страны"
                          className="h-9"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleCreate('country')}
                          disabled={creating === 'country'}
                        >
                          {creating === 'country' ? 'Добавление...' : 'Добавить'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Добавить город</Label>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={newValues.cityCountryId}
                        onChange={handleChange('cityCountryId')}
                      >
                        <option value="">Выберите страну</option>
                        {taxonomy.countries.map((country) => (
                          <option key={country.id} value={country.id}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={newValues.city}
                          onChange={handleChange('city')}
                          placeholder="Название города"
                          className="h-9"
                          disabled={!newValues.cityCountryId}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleCreate('city')}
                          disabled={!newValues.cityCountryId || creating === 'city'}
                        >
                          {creating === 'city' ? 'Добавление...' : 'Добавить'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
