'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import type { CategorizationLog, SystemLog } from '@/lib/types'
import { Loader2, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatConfidence = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : '—'

const statusForLog = (log: CategorizationLog) => {
  if (log.validationCategory && log.predictedCategory) {
    if (log.validationCategory === log.predictedCategory) {
      return {
        label: 'Подтверждено',
        variant: 'default' as const,
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      }
    }
    return {
      label: 'Изменено при проверке',
      variant: 'warning' as const,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    }
  }

  if (log.predictedCategory) {
    return {
      label: 'Сохранено',
      variant: 'secondary' as const,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    }
  }

  return {
    label: 'Ошибка',
    variant: 'destructive' as const,
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  }
}

const badgeVariantClass: Record<string, string> = {
  default: 'bg-primary/10 text-primary border-transparent',
  secondary: 'bg-muted text-foreground border-transparent',
  warning: 'bg-amber-100 text-amber-900 border-transparent dark:bg-amber-400/10 dark:text-amber-300',
  destructive: 'bg-destructive/10 text-destructive border-transparent',
}

const systemLevelClass = (level: string) => {
  const normalized = level?.toLowerCase() ?? ''
  if (normalized === 'error') {
    return 'bg-destructive/10 text-destructive border-transparent'
  }
  if (normalized === 'warning' || normalized === 'warn') {
    return 'bg-amber-100 text-amber-900 border-transparent dark:bg-amber-400/10 dark:text-amber-300'
  }
  if (normalized === 'info') {
    return 'bg-primary/10 text-primary border-transparent'
  }
  return 'bg-muted text-foreground border-transparent'
}

export default function CategorizationLogsPage() {
  const [activeTab, setActiveTab] = useState<'ai' | 'system'>('ai')
  const [aiLogs, setAiLogs] = useState<CategorizationLog[]>([])
  const [aiLoading, setAiLoading] = useState(true)
  const [aiError, setAiError] = useState<string | null>(null)
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])
  const [systemLoading, setSystemLoading] = useState(true)
  const [systemError, setSystemError] = useState<string | null>(null)

  const fetchAiLogs = useCallback(async () => {
    try {
      setAiLoading(true)
      setAiError(null)
      const response = await fetch('/api/categorization-logs?limit=100', {
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Не удалось загрузить логи')
      }
      setAiLogs(result.data ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неожиданная ошибка'
      setAiError(message)
      toast.error(message)
    } finally {
      setAiLoading(false)
    }
  }, [])

  const fetchSystemLogs = useCallback(async () => {
    try {
      setSystemLoading(true)
      setSystemError(null)
      const response = await fetch('/api/system-logs?limit=200', {
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Не удалось загрузить системные логи')
      }
      setSystemLogs(result.data ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неожиданная ошибка'
      setSystemError(message)
      toast.error(message)
    } finally {
      setSystemLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAiLogs()
    fetchSystemLogs()
  }, [fetchAiLogs, fetchSystemLogs])

  const handleRefresh = () => {
    fetchAiLogs()
    fetchSystemLogs()
  }

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Логи системы</h1>
            <p className="text-muted-foreground max-w-2xl">
              Отслеживайте поведение AI и системные ошибки для быстрой диагностики проблем.
            </p>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Логи системы</CardTitle>
              <div className="flex items-center gap-3">
                {(() => {
                  const currentLoading = activeTab === 'ai' ? aiLoading : systemLoading
                  if (!currentLoading) return null
                  return (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {activeTab === 'ai' ? 'Обновление логов классификации…' : 'Обновление системных логов…'}
                    </span>
                  )
                })()}
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={aiLoading || systemLoading}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Обновить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as 'ai' | 'system')}
                className="space-y-4"
              >
                <TabsList>
                  <TabsTrigger value="ai">AI-логи</TabsTrigger>
                  <TabsTrigger value="system">Системные ошибки</TabsTrigger>
                </TabsList>
                <TabsContent value="ai" className="space-y-4">
                  {aiError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {aiError}
                    </div>
                  )}

                  {aiLoading && aiLogs.length === 0 ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={`ai-skeleton-${index}`} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : aiLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-48">Дата</TableHead>
                            <TableHead>Материал</TableHead>
                            <TableHead className="w-40">Категория</TableHead>
                            <TableHead className="w-40">Перепроверка</TableHead>
                            <TableHead className="w-32 text-center">Уверенность</TableHead>
                            <TableHead className="w-32 text-center">Статус</TableHead>
                            <TableHead className="w-[320px]">Reasoning</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aiLogs.map((log) => {
                            const status = statusForLog(log)
                            const finalCategory = (log.metadata as { final_category?: string } | null)?.final_category

                            return (
                              <TableRow key={log.id}>
                                <TableCell className="align-top text-sm text-muted-foreground">
                                  {formatDateTime(log.createdAt)}
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="text-sm font-medium text-foreground break-words">
                                    {log.title || '—'}
                                  </div>
                                  <div className="text-xs text-muted-foreground break-words">
                                    ID: {log.materialId}
                                  </div>
                                  {log.supercategory && (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      Надкатегория: {log.supercategory}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="align-top text-sm">
                                  {log.predictedCategory || '—'}
                                  {finalCategory && finalCategory !== log.predictedCategory && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Итоговая: {finalCategory}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="align-top text-sm">
                                  {log.validationCategory || '—'}
                                  {log.validationConfidence !== null && (
                                    <div className="text-xs text-muted-foreground">
                                      Доверие: {formatConfidence(log.validationConfidence)}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="align-top text-sm text-center">
                                  {formatConfidence(log.confidence)}
                                </TableCell>
                                <TableCell className="align-top text-center">
                                  <Badge variant="outline" className={badgeVariantClass[status.variant] ?? badgeVariantClass.default}>
                                    <span className="mr-1 inline-flex items-center gap-1">
                                      {status.icon}
                                    </span>
                                    {status.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="align-top text-xs text-muted-foreground">
                                  {log.reasoning ? (
                                    <details className="space-y-1">
                                      <summary className="cursor-pointer text-primary">
                                        Показать шаги
                                      </summary>
                                      <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[11px] text-foreground">
{JSON.stringify(log.reasoning, null, 2)}
                                      </pre>
                                    </details>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Пока нет записей. Запустите генерацию или регенерацию таксономии, чтобы увидеть Reasoning.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="system" className="space-y-4">
                  {systemError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {systemError}
                    </div>
                  )}

                  {systemLoading && systemLogs.length === 0 ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={`system-skeleton-${index}`} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : systemLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-48">Дата</TableHead>
                            <TableHead className="w-32 text-center">Уровень</TableHead>
                            <TableHead className="w-48">Источник</TableHead>
                            <TableHead>Сообщение</TableHead>
                            <TableHead className="w-[320px]">Детали</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {systemLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="align-top text-sm text-muted-foreground">
                                {formatDateTime(log.createdAt)}
                              </TableCell>
                              <TableCell className="align-top text-center">
                                <Badge
                                  variant="outline"
                                  className={systemLevelClass(log.level)}
                                >
                                  {log.level?.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top text-sm break-words">
                                {log.source || '—'}
                              </TableCell>
                              <TableCell className="align-top text-sm break-words">
                                {log.message}
                                {log.stack && (
                                  <details className="mt-2 text-xs text-muted-foreground">
                                    <summary className="cursor-pointer text-primary">Стек ошибки</summary>
                                    <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[11px] text-foreground">
{log.stack}
                                    </pre>
                                  </details>
                                )}
                              </TableCell>
                              <TableCell className="align-top text-xs text-muted-foreground">
                                {log.details ? (
                                  <details>
                                    <summary className="cursor-pointer text-primary">Показать</summary>
                                    <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[11px] text-foreground">
{JSON.stringify(log.details, null, 2)}
                                    </pre>
                                  </details>
                                ) : (
                                  <span>—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Системных ошибок пока не зафиксировано.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
