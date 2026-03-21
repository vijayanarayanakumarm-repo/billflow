import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import AuthGuard from '@/components/AuthGuard'

export const metadata: Metadata = {
  title: 'BillFlow - Billing & Invoicing',
  description: 'Modern billing and invoicing application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthGuard sidebar={<Sidebar />}>
          {children}
        </AuthGuard>
      </body>
    </html>
  )
}
