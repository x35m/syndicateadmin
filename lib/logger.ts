import { db } from './db'

export type LogLevel = 'info' | 'warning' | 'error'

export async function logSystemEvent(params: {
  level?: LogLevel | string
  source?: string
  message: string
  details?: Record<string, unknown>
  stack?: string
}) {
  const payload = {
    level: params.level ?? 'info',
    source: params.source,
    message: params.message,
    details: params.details,
    stack: params.stack,
  }

  try {
    await db.logSystemEvent(payload)
  } catch (error: any) {
    console.error('Failed to write system log:', error)
    if (error?.code === '42P01') {
      try {
        await db.init()
        await db.logSystemEvent(payload)
        return
      } catch (initError) {
        console.error('Failed to initialize logging tables:', initError)
      }
    }
  }
}

export async function logSystemError(
  source: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  const details: Record<string, unknown> = context ? { ...context } : {}
  let message = 'Unknown error'
  let stack: string | undefined

  if (error instanceof Error) {
    message = error.message
    stack = error.stack || undefined
    details.errorName = error.name
  } else if (typeof error === 'string') {
    message = error
  } else if (error) {
    try {
      message = JSON.stringify(error)
    } catch {
      message = String(error)
    }
  }

  await logSystemEvent({
    level: 'error',
    source,
    message,
    details: Object.keys(details).length > 0 ? details : undefined,
    stack,
  })
}
