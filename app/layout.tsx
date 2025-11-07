import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Material Admin",
  description: "Admin panel for managing materials from API",
}

// Инициализация cron job при запуске приложения
if (typeof window === 'undefined') {
  import('@/lib/cron').then(({ initCronJob, runInitialFetch }) => {
    initCronJob()
    runInitialFetch()
  })
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
