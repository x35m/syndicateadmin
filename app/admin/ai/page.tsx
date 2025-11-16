'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '@/components/admin-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Save } from 'lucide-react'
import { toast } from 'sonner'

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (быстрая, дешевая)' },
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (мощная)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
]

const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (2025)' },
  { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet (баланс)' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (самый дешевый)' },
]

export default function AIPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiProvider, setAiProvider] = useState<'gemini' | 'claude'>('gemini')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash')
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-20250514')

  const [usage, setUsage] = useState<null | {
    provider: string
    model: string
    limits: { provider: string; model: string; freeTier: string; paidTier: string; notes: string }
    usage: {
      totals: { calls: number; tokensIn: number; tokensOut: number }
      last24h: { calls: number; tokensIn: number; tokensOut: number }
      last7d: { calls: number; tokensIn: number; tokensOut: number }
      byAction: Array<{ action: string; calls: number }>
    }
  }>(null)

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/settings')
        const result = await res.json()
        if (res.ok && result.success) {
          setAiProvider(result.data.aiProvider || 'gemini')
          setGeminiApiKey(result.data.geminiApiKey || '')
          setClaudeApiKey(result.data.claudeApiKey || '')
          setGeminiModel(result.data.geminiModel || 'gemini-2.5-flash')
          setClaudeModel(result.data.claudeModel || 'claude-sonnet-4-20250514')
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const selectedModel = useMemo(
    () => (aiProvider === 'gemini' ? geminiModel : claudeModel),
    [aiProvider, geminiModel, claudeModel]
  )

  const fetchUsage = useCallback(async (prov: string, model: string) => {
    try {
      const resp = await fetch(`/api/ai/usage?provider=${encodeURIComponent(prov)}&model=${encodeURIComponent(model)}`, { cache: 'no-store' })
      const result = await resp.json()
      if (resp.ok && result.success) {
        setUsage(result.data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchUsage(aiProvider, selectedModel)
  }, [aiProvider, selectedModel, fetchUsage])

  const handleSave = async () => {
    const apiKey = aiProvider === 'claude' ? claudeApiKey : geminiApiKey
    if (!apiKey.trim()) {
      toast.warning(`Введите API ключ ${aiProvider === 'claude' ? 'Claude' : 'Gemini'}`)
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiProvider,
          geminiApiKey,
          claudeApiKey,
          geminiModel,
          claudeModel,
        }),
      })
      const result = await response.json()
      if (response.ok && result.success) {
        toast.success('AI настройки сохранены')
      } else {
        toast.error(result.error || 'Не удалось сохранить')
      }
    } catch (e) {
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-background p-8">
        <div className="container max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold">AI</h1>
            <p className="text-muted-foreground mt-2">Управление AI провайдером и расходом</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>AI Провайдер</CardTitle>
              <CardDescription>Анализ таксономии и характеристик материалов</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {aiProvider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'}
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setAiProvider('gemini')}>Google Gemini</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAiProvider('claude')}>Anthropic Claude</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {aiProvider === 'gemini' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">API ключ Gemini</label>
                    <input
                      className="w-full rounded-md border bg-background p-2"
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Модель Gemini</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {GEMINI_MODELS.find((m) => m.value === geminiModel)?.label || geminiModel}
                          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {GEMINI_MODELS.map((m) => (
                          <DropdownMenuItem key={m.value} onClick={() => setGeminiModel(m.value)}>
                            {m.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">API ключ Claude</label>
                    <input
                      className="w-full rounded-md border bg-background p-2"
                      type="password"
                      value={claudeApiKey}
                      onChange={(e) => setClaudeApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Модель Claude</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {CLAUDE_MODELS.find((m) => m.value === claudeModel)?.label || claudeModel}
                          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {CLAUDE_MODELS.map((m) => (
                          <DropdownMenuItem key={m.value} onClick={() => setClaudeModel(m.value)}>
                            {m.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              )}

              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Сохранение...' : (<><Save className="mr-2 h-4 w-4" /> Сохранить</>)}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Расход и вызовы</CardTitle>
              <CardDescription>Сводка использования AI</CardDescription>
            </CardHeader>
            <CardContent>
              {!usage ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Провайдер: <span className="text-foreground font-medium">{usage.provider}</span> · Модель:{' '}
                    <span className="text-foreground font-medium">{usage.model}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Всего вызовов</div>
                      <div className="text-2xl font-semibold">{usage.usage.totals.calls}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">За 24 часа</div>
                      <div className="text-2xl font-semibold">{usage.usage.last24h.calls}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">За 7 дней</div>
                      <div className="text-2xl font-semibold">{usage.usage.last7d.calls}</div>
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-sm font-medium mb-2">Действия</div>
                    {usage.usage.byAction.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Нет данных</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {usage.usage.byAction.map((row) => (
                          <Button key={row.action} size="sm" variant="outline" className="gap-2">
                            <span>{row.action}</span>
                            <Badge variant="secondary">{row.calls}</Badge>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-md border p-3 space-y-1 text-sm">
                    <div className="text-sm font-medium">Квоты и лимиты</div>
                    <div>Провайдер: {usage.limits.provider}</div>
                    <div>Модель: {usage.limits.model}</div>
                    <div>Бесплатный тариф: {usage.limits.freeTier}</div>
                    <div>Платный тариф: {usage.limits.paidTier}</div>
                    <div className="text-muted-foreground">Примечание: {usage.limits.notes}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

