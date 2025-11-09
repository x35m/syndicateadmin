import cron from 'node-cron'
import { apiService } from './api-service'
import { db } from './db'
import { rssParser } from './rss-parser'

let isRunning = false

export async function fetchAndSaveMaterials() {
  if (isRunning) {
    console.log('Previous fetch still running, skipping...')
    return
  }

  isRunning = true
  console.log(`[${new Date().toISOString()}] Starting intelligent synchronization...`)

  try {
    let totalFetched = 0
    let totalNew = 0
    let totalUpdated = 0
    let totalErrors = 0

    // 1. Синхронизируем CommaFeed фиды (если API ключ настроен)
    if (process.env.API_KEY && process.env.API_BASE_URL) {
      try {
        console.log(`[${new Date().toISOString()}] Syncing CommaFeed...`)
        const materials = await apiService.fetchNewMaterials()
        const stats = await db.saveMaterials(materials)
        
        totalFetched += materials.length
        totalNew += stats.new
        totalUpdated += stats.updated
        totalErrors += stats.errors
        
        console.log(`[${new Date().toISOString()}] CommaFeed: ${materials.length} fetched, ${stats.new} new, ${stats.updated} updated`)
      } catch (error) {
        console.error('Error syncing CommaFeed:', error)
      }
    }

    // 2. Синхронизируем локальные RSS фиды
    try {
      console.log(`[${new Date().toISOString()}] Syncing local RSS feeds...`)
      const localFeeds = await db.getAllFeeds()
      
      for (const feed of localFeeds) {
        try {
          console.log(`[${new Date().toISOString()}] Fetching ${feed.title || feed.url}...`)
          const feedData = await rssParser.parseFeed(feed.url)
          const materials = rssParser.convertToMaterials(feed.title || feedData.title, feed.url, feedData.items)
          const stats = await db.saveMaterials(materials)
          
          await db.updateFeedFetchTime(feed.id)
          
          totalFetched += materials.length
          totalNew += stats.new
          totalUpdated += stats.updated
          totalErrors += stats.errors
          
          console.log(`[${new Date().toISOString()}] ${feed.title}: ${materials.length} fetched, ${stats.new} new, ${stats.updated} updated`)
        } catch (feedError) {
          console.error(`[${new Date().toISOString()}] Error syncing feed ${feed.title}:`, feedError)
          totalErrors++
        }
      }
      
      console.log(`[${new Date().toISOString()}] Synced ${localFeeds.length} local feeds`)
    } catch (error) {
      console.error('Error syncing local feeds:', error)
    }
    
    console.log(`[${new Date().toISOString()}] ✅ Sync completed:`)
    console.log(`  📥 New materials: ${totalNew}`)
    console.log(`  🔄 Updated materials: ${totalUpdated}`)
    console.log(`  ❌ Errors: ${totalErrors}`)
    console.log(`  📊 Total processed: ${totalFetched}`)

    return { 
      fetched: totalFetched, 
      new: totalNew, 
      updated: totalUpdated,
      errors: totalErrors 
    }
  } catch (error) {
    console.error('Error in fetchAndSaveMaterials:', error)
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
  }
}
