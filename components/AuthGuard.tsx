'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export default function AuthGuard({
  children,
  sidebar,
}: {
  children: React.ReactNode
  sidebar: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (pathname === '/login') {
      setChecked(true)
      return
    }
    const session = localStorage.getItem('billflow_session')
    if (!session) {
      router.replace('/login')
    } else {
      setChecked(true)
    }
  }, [pathname, router])

  if (!checked) return null

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <>
      {sidebar}
      <main className="ml-64 min-h-screen bg-slate-50">{children}</main>
    </>
  )
}
