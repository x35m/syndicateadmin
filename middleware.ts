import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Проверяем, является ли путь админским
  if (pathname.startsWith('/admin')) {
    // Пропускаем страницу логина
    if (pathname === '/admin/login') {
      return NextResponse.next()
    }

    // Проверяем наличие токена авторизации
    const authToken = request.cookies.get('admin_auth')?.value

    if (!authToken || authToken !== 'authenticated') {
      // Перенаправляем на страницу логина
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}

