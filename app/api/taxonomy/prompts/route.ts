'use server'

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type PromptType = 'category' | 'theme' | 'tag' | 'alliance' | 'country' | 'city'

const PROMPT_SETTINGS_MAP: Record<PromptType, { key: string; default: string }> = {
  category: {
    key: 'taxonomy_prompt_category',
    default:
      'Определи одну или несколько категорий, основываясь на главной тематике статьи.',
  },
  theme: {
    key: 'taxonomy_prompt_theme',
    default: 'Подбери тематические направления, отражающие сюжет и контекст материала.',
  },
  tag: {
    key: 'taxonomy_prompt_tag',
    default:
      'Сформируй теги для поиска и фильтрации, используй ключевые термины и факты.',
  },
  alliance: {
    key: 'taxonomy_prompt_alliance',
    default:
      'Определи международные союзы, блоки или объединения, к которым относится статья.',
  },
  country: {
    key: 'taxonomy_prompt_country',
    default: 'Выбери страну, если материал ясно связан с конкретным государством.',
  },
  city: {
    key: 'taxonomy_prompt_city',
    default:
      'Укажи город, если он явно присутствует в материале и важен для контекста.',
  },
}

export async function GET() {
  try {
    const settings = await db.getSettings()
    const prompts: Record<PromptType, string> = {
      category:
        settings[PROMPT_SETTINGS_MAP.category.key] ?? PROMPT_SETTINGS_MAP.category.default,
      theme: settings[PROMPT_SETTINGS_MAP.theme.key] ?? PROMPT_SETTINGS_MAP.theme.default,
      tag: settings[PROMPT_SETTINGS_MAP.tag.key] ?? PROMPT_SETTINGS_MAP.tag.default,
      alliance:
        settings[PROMPT_SETTINGS_MAP.alliance.key] ??
        PROMPT_SETTINGS_MAP.alliance.default,
      country:
        settings[PROMPT_SETTINGS_MAP.country.key] ?? PROMPT_SETTINGS_MAP.country.default,
      city: settings[PROMPT_SETTINGS_MAP.city.key] ?? PROMPT_SETTINGS_MAP.city.default,
    }

    return NextResponse.json({ success: true, data: prompts })
  } catch (error) {
    console.error('Error fetching taxonomy prompts:', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось получить системные промпты' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, prompt } = body as { type?: PromptType; prompt?: string }

    if (!type || typeof prompt !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Некорректные параметры запроса' },
        { status: 400 }
      )
    }

    const config = PROMPT_SETTINGS_MAP[type]
    await db.setSetting(config.key, prompt.trim())

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating taxonomy prompt:', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить промпт' },
      { status: 500 }
    )
  }
}

