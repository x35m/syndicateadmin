import cron from 'node-cron'
import { db } from './db'
import { rssParser } from './rss-parser'

let isRunning = false

export async function fetchAndSaveMaterials() {
  if (isRunning) {
    console.log('Previous fetch still running, skipping...')
    return
  }

  isRunning = true
  console.log(`[${new Date().toISOString()}] Starting RSS synchronization...`)

  try {
    let totalFetched = 0
    let totalNew = 0
    let totalUpdated = 0
    let totalErrors = 0

    // Синхронизируем RSS фиды
    const feeds = await db.getAllFeeds()
    
    if (feeds.length === 0) {
      console.log(`[${new Date().toISOString()}] No RSS feeds configured. Add feeds via admin panel.`)
      return { 
        fetched: 0, 
        new: 0, 
        updated: 0,
        errors: 0 
      }
    }
    
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
        
        console.log(`[${new Date().toISOString()}] ${feed.title}: ${materials.length} fetched, ${stats.new} new, ${stats.updated} updated`)
      } catch (feedError) {
        console.error(`[${new Date().toISOString()}] Error syncing feed ${feed.title}:`, feedError)
        totalErrors++
      }
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
