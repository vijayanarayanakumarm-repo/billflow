'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  BarChart2,
  Settings,
  Zap,
  LogOut,
  UserCog,
  BookOpen,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard',    href: '/',              icon: LayoutDashboard },
  { label: 'Customers',    href: '/customers',      icon: Users },
  { label: 'Items Master', href: '/descriptions',   icon: BookOpen },
  { label: 'Invoices',     href: '/invoices',       icon: FileText },
  { label: 'Payments',     href: '/payments',       icon: CreditCard },
  { label: 'Reports',      href: '/reports',        icon: BarChart2 },
  { label: 'Users',        href: '/users',          icon: UserCog },
  { label: 'Settings',     href: '/settings',       icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    localStorage.removeItem('billflow_session')
    router.push('/login')
  }

  const session = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('billflow_session') ?? '{}')
    : {}

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-slate-700/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#3b5bdb]">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">BillFlow</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#3b5bdb] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700/50 space-y-3">
        {session?.username && (
          <p className="text-xs text-slate-400 px-2">
            Signed in as <span className="font-semibold text-slate-300">{session.username}</span>
          </p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  )
}
