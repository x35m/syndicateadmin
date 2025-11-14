import cron from 'node-cron'
import { db } from './db'
import { rssParser } from './rss-parser'
import { broadcastNewMaterial, broadcastSyncProgress, broadcastSyncComplete } from './sse-manager'
import { logSystemError } from './logger'
import { syncTelegramChannels } from './telegram/service'

let isRunning = false

export interface FetchMaterialsOptions {
  feedIds?: number[]
}

export async function fetchAndSaveMaterials(options?: FetchMaterialsOptions) {
  if (isRunning) {
    console.log('Previous fetch still running, skipping...')
    return
  }

  isRunning = true
  console.log(`[${new Date().toISOString()}] Starting synchronization (RSS + Telegram)...`)

  try {
    let totalFetched = 0
    let totalNew = 0
    let totalUpdated = 0
    let totalErrors = 0

    // Синхронизируем RSS фиды
    const feedsList = options?.feedIds && options.feedIds.length > 0
      ? await db.getFeedsByIds(options.feedIds)
      : await db.getActiveFeeds()
    const feeds = feedsList.filter((feed) => feed.status === 'active')
    
    if (feeds.length === 0) {
      console.log(`[${new Date().toISOString()}] No RSS feeds active. Skipping RSS step.`)
    } else {
      console.log(`[${new Date().toISOString()}] Syncing ${feeds.length} RSS feeds...`)
      
      for (const feed of feeds) {
        try {
          console.log(`[${new Date().toISOString()}] Fetching ${feed.title || feed.url}...`)
          const feedData = await rssParser.parseFeed(feed.url)
          const materials = await rssParser.convertToMaterials(feed.title || feedData.title, feed.url, feedData.items)
          const stats = await db.saveMaterials(materials)
          
          await db.updateFeedFetchTime(feed.id)
          
          totalFetched += materials.length
          totalNew += stats.new
          totalUpdated += stats.updated
          totalErrors += stats.errors

          broadcastSyncProgress({
            feed: feed.title || feed.url,
            new: stats.new,
            updated: stats.updated,
            total: materials.length,
          })
          
          for (const newMaterial of stats.newMaterials) {
            broadcastNewMaterial(newMaterial)
          }
          
          console.log(`[${new Date().toISOString()}] ${feed.title}: ${materials.length} fetched, ${stats.new} new, ${stats.updated} updated`)
        } catch (feedError) {
          console.error(`[${new Date().toISOString()}] Error syncing feed ${feed.title}:`, feedError)
          await logSystemError('cron/fetch-feed', feedError, {
            feedId: feed.id,
            feedTitle: feed.title,
            feedUrl: feed.url,
          })
          totalErrors++
        }
      }
    }

    // Telegram synchronization
    let telegramStats = { fetched: 0, new: 0, updated: 0, errors: 0 }
    try {
      const syncResult = await syncTelegramChannels()
      if (syncResult) {
        telegramStats = syncResult
        totalFetched += syncResult.fetched
        totalNew += syncResult.new
        totalUpdated += syncResult.updated
        totalErrors += syncResult.errors

        if (syncResult.skipped) {
          console.warn(`[${new Date().toISOString()}] Telegram sync skipped: ${syncResult.message}`)
        } else {
          console.log(
            `[${new Date().toISOString()}] Telegram sync: ${syncResult.fetched} fetched, ${syncResult.new} new, ${syncResult.updated} updated`
          )
        }
      }
    } catch (telegramError) {
      console.error('Telegram sync error:', telegramError)
      await logSystemError('cron/telegram-sync', telegramError)
      totalErrors++
    }
    
    // Broadcast sync completion
    broadcastSyncComplete({
      new: totalNew,
      updated: totalUpdated,
      errors: totalErrors,
    })
    
    console.log(`[${new Date().toISOString()}] ✅ Sync completed:`)
    console.log(`  📥 New materials: ${totalNew}`)
    console.log(`  🔄 Updated materials: ${totalUpdated}`)
    console.log(`  ❌ Errors: ${totalErrors}`)
    console.log(`  📊 Total processed: ${totalFetched}`)

    return { 
      fetched: totalFetched, 
      new: totalNew, 
      updated: totalUpdated,
      errors: totalErrors,
      telegram: telegramStats,
    }
  } catch (error) {
    console.error('Error in fetchAndSaveMaterials:', error)
    await logSystemError('cron/fetch-and-save', error)
    throw error
  } finally {
    isRunning = false
  }
}

// Инициализируем cron job
export function initCronJob() {
  // Запуск каждые 5 минут: '*/5 * * * *'
  const job = cron.schedule('*/5 * * * *', async () => {
    try {
      await fetchAndSaveMaterials()
    } catch (error) {
      console.error('Cron job error:', error)
      await logSystemError('cron/job', error)
    }
  })

  console.log('Cron job initialized: running every 5 minutes')
  
  return job
}

// Функция для запуска сразу при старте приложения
export async function runInitialFetch() {
  try {
    await db.init()
    await fetchAndSaveMaterials()
  } catch (error) {
    console.error('Initial fetch error:', error)
    await logSystemError('cron/initial-fetch', error)
  }
}
