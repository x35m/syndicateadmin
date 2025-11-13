import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logSystemError } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST() {
  try {
    cookies().delete('admin_auth')

    return NextResponse.json({
      success: true,
      message: 'Logout successful',
    })
  } catch (error) {
    console.error('Logout error:', error)
    await logSystemError('api/admin/logout', error)
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    )
  }
}

