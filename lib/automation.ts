import { db } from './db'
import { fetchAndSaveMaterials } from './cron'
import { logSystemError } from './logger'
import type { AutomationConfig } from './types'
import {
  DEFAULT_AUTOMATION_CONFIG,
  MIN_INTERVAL_MINUTES,
  normalizeAutomationConfig,
} from './automation-config'

const AUTOMATION_DISABLED = process.env.AUTOMATION_DISABLED === 'true'

const INTERNAL_API_BASE =
  process.env.AUTOMATION_API_BASE ||
  process.env.INTERNAL_API_BASE ||
  process.env.NEXT_PUBLIC_APP_URL ||
  `http://127.0.0.1:${process.env.PORT || 3000}`

async function callInternalApi(path: string, init: RequestInit): Promise<any> {
  const url = new URL(path, INTERNAL_API_BASE)
  const response = await fetch(url.toString(), {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  const text = await response.text()
  let payload: any = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message = payload?.error || response.statusText || 'Internal API call failed'
    throw new Error(message)
  }

  return payload
}

class AutomationScheduler {
  private config: AutomationConfig = JSON.parse(JSON.stringify(DEFAULT_AUTOMATION_CONFIG))
  private timers: Partial<Record<keyof AutomationConfig, NodeJS.Timeout>> = {}
  private locks: Record<keyof AutomationConfig, boolean> = {
    import: false,
    processing: false,
    publishing: false,
  }

  async init() {
    if (AUTOMATION_DISABLED) {
      console.warn('[automation] Scheduler disabled via AUTOMATION_DISABLED=true')
      return
    }

    await this.reloadConfig()
    this.scheduleAll()
  }

  async reloadConfig() {
    try {
      const stored = await db.getAutomationConfig()
      this.config = normalizeAutomationConfig(stored)
    } catch (error) {
      console.error('[automation] Failed to load automation config:', error)
      this.config = JSON.parse(JSON.stringify(DEFAULT_AUTOMATION_CONFIG))
    }
  }

  async refresh() {
    await this.reloadConfig()
    this.scheduleAll()
  }

  private scheduleAll() {
    this.clearTimers()
    this.scheduleImport()
    this.scheduleProcessing()
    this.schedulePublishing()
  }

  private clearTimers() {
    for (const key of Object.keys(this.timers) as (keyof AutomationConfig)[]) {
      const timer = this.timers[key]
      if (timer) {
        clearInterval(timer)
        this.timers[key] = undefined
      }
    }
  }

  private scheduleImport() {
    if (!this.config.import.enabled) return

    const intervalMs = Math.max(this.config.import.intervalMinutes, MIN_INTERVAL_MINUTES) * 60_000
    this.timers.import = setInterval(() => {
      this.executeWithLock('import', () => this.runImport())
    }, intervalMs)
  }

  private scheduleProcessing() {
    if (!this.config.processing.enabled) return

    const intervalMs = Math.max(this.config.processing.intervalMinutes, MIN_INTERVAL_MINUTES) * 60_000
    this.timers.processing = setInterval(() => {
      this.executeWithLock('processing', () => this.runProcessing())
    }, intervalMs)
  }

  private schedulePublishing() {
    if (!this.config.publishing.enabled) return

    const intervalMs = Math.max(this.config.publishing.intervalMinutes, MIN_INTERVAL_MINUTES) * 60_000
    this.timers.publishing = setInterval(() => {
      this.executeWithLock('publishing', () => this.runPublishing())
    }, intervalMs)
  }

  private async executeWithLock(section: keyof AutomationConfig, task: () => Promise<void>) {
    if (AUTOMATION_DISABLED) return
    if (this.locks[section]) return

    this.locks[section] = true
    try {
      await task()
      await this.markLastRun(section)
    } catch (error) {
      await logSystemError(`automation/${section}`, error)
    } finally {
      this.locks[section] = false
    }
  }

  private async markLastRun(section: keyof AutomationConfig) {
    const timestamp = new Date().toISOString()
    const stored = normalizeAutomationConfig(await db.getAutomationConfig())
    stored[section].lastRunAt = timestamp
    await db.setAutomationConfig(stored)
    this.config = stored
  }

  private async runImport() {
    try {
      if (this.config.import.scope === 'selected') {
        const selectedFeedIds = this.config.import.feedIds
        if (selectedFeedIds.length === 0) {
          return
        }

        const feeds = await db.getFeedsByIds(selectedFeedIds)
        const activeFeedIds = feeds.filter((feed) => feed.status === 'active').map((feed) => feed.id)
        if (activeFeedIds.length === 0) {
          return
        }

        await fetchAndSaveMaterials({ feedIds: activeFeedIds })
      } else {
        await fetchAndSaveMaterials()
      }
    } catch (error) {
      throw error
    }
  }

  private async runProcessing() {
    const batchSize = Math.max(1, this.config.processing.batchSize)
    const materialIds = await db.getMaterialIdsByStatus('new', batchSize)
    if (materialIds.length === 0) {
      return
    }

    for (const materialId of materialIds) {
      try {
        await callInternalApi('/api/materials/generate-summary', {
          method: 'POST',
          body: JSON.stringify({ materialId }),
        })
      } catch (error) {
        await logSystemError('automation/processing-item', error, {
          materialId,
        })
      }
    }
  }

  private async runPublishing() {
    const batchSize = Math.max(1, this.config.publishing.batchSize)

    const categoryIds =
      this.config.publishing.scope === 'selected'
        ? this.config.publishing.categoryIds
        : await db.getVisibleCategoryIds()

    const materialIds = await db.getMaterialIdsForPublishing(categoryIds, batchSize)
    if (materialIds.length === 0) {
      return
    }

    for (const materialId of materialIds) {
      try {
        await callInternalApi('/api/materials', {
          method: 'PATCH',
          body: JSON.stringify({ id: materialId, status: 'published' }),
        })
      } catch (error) {
        await logSystemError('automation/publishing-item', error, {
          materialId,
        })
      }
    }
  }
}

let scheduler: AutomationScheduler | null = null
let schedulerInitPromise: Promise<void> | null = null

export async function initAutomationScheduler(): Promise<void> {
  if (AUTOMATION_DISABLED) {
    return
  }

  if (!scheduler) {
    scheduler = new AutomationScheduler()
    schedulerInitPromise = scheduler.init()
  }

  await schedulerInitPromise
}

export async function refreshAutomationScheduler(): Promise<void> {
  if (AUTOMATION_DISABLED) {
    return
  }

  if (!scheduler) {
    await initAutomationScheduler()
    return
  }

  await scheduler.refresh()
}
