'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'

export function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = [
    { href: '/admin', label: 'Дашборд' },
    { href: '/admin/materials', label: 'Материалы' },
    { href: '/admin/rss', label: 'RSS фиды' },
    { href: '/admin/home-settings', label: 'Главная' },
    { href: '/admin/telegram', label: 'Telegram' },
    { href: '/admin/automation', label: 'Автоматизация' },
    { href: '/admin/taxonomy', label: 'Справочники' },
    { href: '/admin/logs', label: 'Логи' },
    { href: '/admin/settings', label: 'AI' },
  ]

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
      })

      if (response.ok) {
        toast.success('Вы вышли из системы')
        router.push('/admin/login')
        router.refresh()
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Ошибка при выходе')
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex gap-6 md:gap-10">
          <Link href="/admin" className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight">
              SYNDICATE <span className="text-primary">admin</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname === item.href
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Выход
        </Button>
      </div>
    </header>
  )
}

