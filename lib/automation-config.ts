import type {
  AutomationConfig,
  AutomationImportConfig,
  AutomationProcessingConfig,
  AutomationPublishingConfig,
  AutomationScope,
} from './types'

export const MIN_INTERVAL_MINUTES = 1
export const DEFAULT_IMPORT_INTERVAL = 30
export const DEFAULT_PROCESSING_INTERVAL = 15
export const DEFAULT_PUBLISHING_INTERVAL = 60
export const DEFAULT_PROCESSING_BATCH = 5
export const DEFAULT_PUBLISHING_BATCH = 10

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  import: {
    enabled: false,
    intervalMinutes: DEFAULT_IMPORT_INTERVAL,
    scope: 'all',
    feedIds: [],
    lastRunAt: null,
  },
  processing: {
    enabled: false,
    intervalMinutes: DEFAULT_PROCESSING_INTERVAL,
    batchSize: DEFAULT_PROCESSING_BATCH,
    lastRunAt: null,
  },
  publishing: {
    enabled: false,
    intervalMinutes: DEFAULT_PUBLISHING_INTERVAL,
    scope: 'all',
    categoryIds: [],
    batchSize: DEFAULT_PUBLISHING_BATCH,
    lastRunAt: null,
  },
}

export function normalizeAutomationScope(scope?: AutomationScope): AutomationScope {
  return scope === 'selected' ? 'selected' : 'all'
}

function normalizeImportConfig(config?: Partial<AutomationImportConfig>): AutomationImportConfig {
  const interval = Math.max(MIN_INTERVAL_MINUTES, Math.trunc(config?.intervalMinutes ?? DEFAULT_IMPORT_INTERVAL))
  const scope = normalizeAutomationScope(config?.scope)
  const feedIds = Array.isArray(config?.feedIds)
    ? Array.from(new Set(config!.feedIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0)))
    : []

  return {
    enabled: Boolean(config?.enabled),
    intervalMinutes: interval,
    scope,
    feedIds,
    lastRunAt: config?.lastRunAt ?? null,
  }
}

function normalizeProcessingConfig(config?: Partial<AutomationProcessingConfig>): AutomationProcessingConfig {
  const interval = Math.max(MIN_INTERVAL_MINUTES, Math.trunc(config?.intervalMinutes ?? DEFAULT_PROCESSING_INTERVAL))
  const batchSize = Math.max(1, Math.trunc(config?.batchSize ?? DEFAULT_PROCESSING_BATCH))

  return {
    enabled: Boolean(config?.enabled),
    intervalMinutes: interval,
    batchSize,
    lastRunAt: config?.lastRunAt ?? null,
  }
}

function normalizePublishingConfig(config?: Partial<AutomationPublishingConfig>): AutomationPublishingConfig {
  const interval = Math.max(MIN_INTERVAL_MINUTES, Math.trunc(config?.intervalMinutes ?? DEFAULT_PUBLISHING_INTERVAL))
  const scope = normalizeAutomationScope(config?.scope)
  const categoryIds = Array.isArray(config?.categoryIds)
    ? Array.from(new Set(config!.categoryIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0)))
    : []
  const batchSize = Math.max(1, Math.trunc(config?.batchSize ?? DEFAULT_PUBLISHING_BATCH))

  return {
    enabled: Boolean(config?.enabled),
    intervalMinutes: interval,
    scope,
    categoryIds,
    batchSize,
    lastRunAt: config?.lastRunAt ?? null,
  }
}

export function normalizeAutomationConfig(input?: AutomationConfig | null): AutomationConfig {
  if (!input) {
    return JSON.parse(JSON.stringify(DEFAULT_AUTOMATION_CONFIG)) as AutomationConfig
  }

  return {
    import: normalizeImportConfig(input.import),
    processing: normalizeProcessingConfig(input.processing),
    publishing: normalizePublishingConfig(input.publishing),
  }
}
