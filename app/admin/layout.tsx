import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Syndicate Admin - Панель управления',
  description: 'Административная панель для управления RSS-фидами, материалами и настройками сервиса Syndicate.',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

