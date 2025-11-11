'use client'

import { useEffect, useState, ChangeEvent } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [editing, setEditing] = useState<{
    type: TaxonomyType
    id: number
    name: string
    countryId?: number | ''
  } | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<{ type: TaxonomyType; id: number } | null>(null)

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

  const handleUpdate = async () => {
    if (!editing) return

    const trimmedName = editing.name.trim()
    if (!trimmedName) {
      toast.warning('Введите название')
      return
    }

    if (editing.type === 'city' && !editing.countryId) {
      toast.warning('Выберите страну')
      return
    }

    try {
      setUpdating(true)
      const response = await fetch('/api/taxonomy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editing.type,
          id: editing.id,
          name: trimmedName,
          countryId:
            editing.type === 'city' && editing.countryId
              ? Number(editing.countryId)
              : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        toast.error(result.error || 'Не удалось сохранить изменения')
        return
      }

      toast.success('Изменения сохранены')
      setEditing(null)
      await fetchTaxonomy()
    } catch (error) {
      console.error('Error updating taxonomy item:', error)
      toast.error('Не удалось сохранить изменения')
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (type: TaxonomyType, id: number, name?: string) => {
    const confirmationMessage =
      type === 'country'
        ? `Удалить страну "${name ?? id}" вместе со всеми городами?`
        : `Удалить элемент "${name ?? id}"?`

    if (typeof window !== 'undefined' && !window.confirm(confirmationMessage)) {
      return
    }

    try {
      setDeleting({ type, id })
      const response = await fetch(`/api/taxonomy?type=${type}&id=${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        toast.error(result.error || 'Не удалось удалить элемент')
        return
      }

      if (editing && editing.type === type && editing.id === id) {
        setEditing(null)
      }

      toast.success('Элемент удалён')
      await fetchTaxonomy()
    } catch (error) {
      console.error('Error deleting taxonomy item:', error)
      toast.error('Не удалось удалить элемент')
    } finally {
      setDeleting(null)
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
                <div className="space-y-2">
                    {taxonomy.categories.length > 0 ? (
                      taxonomy.categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        {editing?.type === 'category' && editing.id === category.id ? (
                          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              value={editing.name}
                              onChange={(e) =>
                                setEditing((prev) =>
                                  prev ? { ...prev, name: e.target.value } : prev
                                )
                              }
                              className="h-9 flex-1"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleUpdate} disabled={updating}>
                                Сохранить
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(null)}
                                disabled={updating}
                              >
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium">{category.name}</span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setEditing({
                                    type: 'category',
                                    id: category.id,
                                    name: category.name,
                                  })
                                }
                              >
                                Изменить
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete('category', category.id, category.name)}
                                disabled={deleting?.type === 'category' && deleting.id === category.id}
                              >
                                Удалить
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
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
                <div className="space-y-2">
                    {taxonomy.themes.length > 0 ? (
                      taxonomy.themes.map((theme) => (
                      <div
                        key={theme.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        {editing?.type === 'theme' && editing.id === theme.id ? (
                          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              value={editing.name}
                              onChange={(e) =>
                                setEditing((prev) =>
                                  prev ? { ...prev, name: e.target.value } : prev
                                )
                              }
                              className="h-9 flex-1"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleUpdate} disabled={updating}>
                                Сохранить
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(null)}
                                disabled={updating}
                              >
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium">{theme.name}</span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setEditing({
                                    type: 'theme',
                                    id: theme.id,
                                    name: theme.name,
                                  })
                                }
                              >
                                Изменить
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete('theme', theme.id, theme.name)}
                                disabled={deleting?.type === 'theme' && deleting.id === theme.id}
                              >
                                Удалить
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
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
                <div className="space-y-2">
                    {taxonomy.tags.length > 0 ? (
                      taxonomy.tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        {editing?.type === 'tag' && editing.id === tag.id ? (
                          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              value={editing.name}
                              onChange={(e) =>
                                setEditing((prev) =>
                                  prev ? { ...prev, name: e.target.value } : prev
                                )
                              }
                              className="h-9 flex-1"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleUpdate} disabled={updating}>
                                Сохранить
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(null)}
                                disabled={updating}
                              >
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium">{tag.name}</span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setEditing({
                                    type: 'tag',
                                    id: tag.id,
                                    name: tag.name,
                                  })
                                }
                              >
                                Изменить
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete('tag', tag.id, tag.name)}
                                disabled={deleting?.type === 'tag' && deleting.id === tag.id}
                              >
                                Удалить
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
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
                        <div key={country.id} className="rounded-md border p-4 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            {editing?.type === 'country' && editing.id === country.id ? (
                              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                                <Input
                                  value={editing.name}
                                  onChange={(e) =>
                                    setEditing((prev) =>
                                      prev ? { ...prev, name: e.target.value } : prev
                                    )
                                  }
                                  className="h-9 flex-1"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleUpdate} disabled={updating}>
                                    Сохранить
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditing(null)}
                                    disabled={updating}
                                  >
                                    Отмена
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm font-semibold">{country.name}</span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setEditing({
                                        type: 'country',
                                        id: country.id,
                                        name: country.name,
                                      })
                                    }
                                  >
                                    Изменить
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleDelete('country', country.id, country.name)
                                    }
                                    disabled={
                                      deleting?.type === 'country' && deleting.id === country.id
                                    }
                                  >
                                    Удалить
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="space-y-2">
                            {country.cities.length > 0 ? (
                              country.cities.map((city) => (
                                <div
                                  key={city.id}
                                  className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  {editing?.type === 'city' && editing.id === city.id ? (
                                    <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
                                      <Input
                                        value={editing.name}
                                        onChange={(e) =>
                                          setEditing((prev) =>
                                            prev ? { ...prev, name: e.target.value } : prev
                                          )
                                        }
                                        className="h-9 flex-1"
                                        autoFocus
                                      />
                                      <select
                                        className="w-full rounded-md border bg-background px-3 py-2 text-sm md:w-52"
                                        value={
                                          editing.countryId !== undefined ? String(editing.countryId) : ''
                                        }
                                        onChange={(event) =>
                                          setEditing((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  countryId: event.target.value
                                                    ? Number(event.target.value)
                                                    : '',
                                                }
                                              : prev
                                          )
                                        }
                                      >
                                        <option value="">Страна</option>
                                        {taxonomy.countries.map((option) => (
                                          <option key={option.id} value={option.id}>
                                            {option.name}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={handleUpdate} disabled={updating}>
                                          Сохранить
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setEditing(null)}
                                          disabled={updating}
                                        >
                                          Отмена
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div>
                                        <div className="text-sm font-medium">{city.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          Принадлежит: {country.name}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            setEditing({
                                              type: 'city',
                                              id: city.id,
                                              name: city.name,
                                              countryId: city.countryId,
                                            })
                                          }
                                        >
                                          Изменить
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDelete('city', city.id, city.name)}
                                          disabled={
                                            deleting?.type === 'city' && deleting.id === city.id
                                          }
                                        >
                                          Удалить
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                Города не добавлены
                              </div>
                            )}
                          </div>
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
