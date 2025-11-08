import cron from 'node-cron'
import { apiService } from './api-service'
import { db } from './db'

let isRunning = false

export async function fetchAndSaveMaterials() {
  if (isRunning) {
    console.log('Previous fetch still running, skipping...')
    return
  }

  isRunning = true
  console.log(`[${new Date().toISOString()}] Starting intelligent synchronization...`)

  try {
    // Получаем новые материалы из API (теперь из каждого фида отдельно)
    const materials = await apiService.fetchNewMaterials()
    console.log(`[${new Date().toISOString()}] Total fetched: ${materials.length} materials`)

    // Сохраняем в базу данных
    const stats = await db.saveMaterials(materials)
    
    console.log(`[${new Date().toISOString()}] ✅ Sync completed:`)
    console.log(`  📥 New materials: ${stats.new}`)
    console.log(`  🔄 Updated materials: ${stats.updated}`)
    console.log(`  ❌ Errors: ${stats.errors}`)
    console.log(`  📊 Total processed: ${materials.length}`)

    return { 
      fetched: materials.length, 
      new: stats.new, 
      updated: stats.updated,
      errors: stats.errors 
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
