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
  console.log(`[${new Date().toISOString()}] Starting material fetch...`)

  try {
    // Получаем новые материалы из API
    const materials = await apiService.fetchNewMaterials()
    console.log(`Fetched ${materials.length} materials from API`)

    // Сохраняем в базу данных
    const savedCount = await db.saveMaterials(materials)
    console.log(`Saved ${savedCount} new materials to database`)

    return { fetched: materials.length, saved: savedCount }
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
