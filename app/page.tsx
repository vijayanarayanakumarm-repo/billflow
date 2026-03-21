'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Invoice } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { Users, TrendingUp, AlertCircle, Clock } from 'lucide-react'

type KPIs = {
  totalCustomers: number
  revenueThisMonth: number
  outstanding: number
  overdueCount: number
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<KPIs>({
    totalCustomers: 0,
    revenueThisMonth: 0,
    outstanding: 0,
    overdueCount: 0,
  })
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const isoDate = thirtyDaysAgo.toISOString().split('T')[0]

      const [
        { count: custCount },
        { data: paidInvoices },
        { data: outstandingInvoices },
        { data: overdueInvoices },
        { data: recent },
      ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase
          .from('invoices')
          .select('total')
          .eq('status', 'paid')
          .gte('issue_date', isoDate),
        supabase
          .from('invoices')
          .select('total')
          .in('status', ['sent', 'overdue']),
        supabase
          .from('invoices')
          .select('id')
          .eq('status', 'overdue'),
        supabase
          .from('invoices')
          .select('*, customers(name, company)')
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      setKpis({
        totalCustomers: custCount ?? 0,
        revenueThisMonth: (paidInvoices ?? []).reduce((s, i) => s + Number(i.total), 0),
        outstanding: (outstandingInvoices ?? []).reduce((s, i) => s + Number(i.total), 0),
        overdueCount: (overdueInvoices ?? []).length,
      })
      setRecentInvoices((recent as Invoice[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const kpiCards = [
    { label: 'Total Customers', value: kpis.totalCustomers.toString(), icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Revenue (30 days)', value: fmt(kpis.revenueThisMonth), icon: TrendingUp, color: 'bg-green-50 text-green-600' },
    { label: 'Outstanding', value: fmt(kpis.outstanding), icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Overdue Invoices', value: kpis.overdueCount.toString(), icon: AlertCircle, color: 'bg-red-50 text-red-600' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500 font-medium">{label}</p>
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {loading ? '—' : value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Invoices */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Invoices</h2>
          <Link href="/invoices" className="text-sm text-[#3b5bdb] hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">Loading...</td>
                </tr>
              ) : recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    No invoices yet.{' '}
                    <Link href="/invoices/new" className="text-[#3b5bdb] hover:underline">Create one</Link>
                  </td>
                </tr>
              ) : (
                recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link href={`/invoices/${inv.id}`} className="text-[#3b5bdb] hover:underline font-medium">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {(inv.customers as any)?.company || (inv.customers as any)?.name || '—'}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-900">{fmt(inv.total)}</td>
                    <td className="px-6 py-3 text-slate-600">{inv.due_date}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
