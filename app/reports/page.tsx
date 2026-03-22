'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Download } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

export const dynamic = 'force-dynamic'

type MonthData = { month: string; revenue: number }
type StatusData = { name: string; value: number }
type TopCustomer = { name: string; company: string; revenue: number; pct: number }

const PIE_COLORS = ['#3b5bdb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']
const STATUS_COLORS: Record<string, string> = {
  paid: '#22c55e',
  sent: '#3b5bdb',
  draft: '#94a3b8',
  overdue: '#ef4444',
  cancelled: '#f97316',
}

export default function Reports() {
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthData[]>([])
  const [statusBreakdown, setStatusBreakdown] = useState<StatusData[]>([])
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Last 6 months
      const months: MonthData[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - i)
        const start = d.toISOString().split('T')[0]
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })

        const { data } = await supabase
          .from('payments')
          .select('amount')
          .gte('payment_date', start)
          .lte('payment_date', end)

        const revenue = (data ?? []).reduce((s, p) => s + Number(p.amount), 0)
        months.push({ month: label, revenue })
      }
      setMonthlyRevenue(months)

      // Status breakdown
      const { data: invData } = await supabase.from('invoices').select('status')
      const counts: Record<string, number> = {}
      ;(invData ?? []).forEach((inv) => { counts[inv.status] = (counts[inv.status] ?? 0) + 1 })
      setStatusBreakdown(Object.entries(counts).map(([name, value]) => ({ name, value })))

      // Top 5 customers by revenue
      const { data: payData } = await supabase
        .from('payments')
        .select('amount, customers(id, name, company)')
      const revByCustomer: Record<string, { name: string; company: string; revenue: number }> = {}
      ;(payData ?? []).forEach((p) => {
        const c = (p.customers as any)
        if (!c) return
        const key = c.id
        if (!revByCustomer[key]) revByCustomer[key] = { name: c.name, company: c.company ?? '', revenue: 0 }
        revByCustomer[key].revenue += Number(p.amount)
      })
      const sorted = Object.values(revByCustomer).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
      const maxRev = sorted[0]?.revenue ?? 1
      setTopCustomers(sorted.map((c) => ({ ...c, pct: (c.revenue / maxRev) * 100 })))

      // All payments for CSV
      const { data: allPay } = await supabase
        .from('payments')
        .select('*, invoices(invoice_number), customers(name, company)')
        .order('payment_date', { ascending: false })
      setPayments(allPay ?? [])

      setLoading(false)
    }
    load()
  }, [])

  function exportCSV() {
    const headers = ['Invoice #', 'Customer', 'Date', 'Method', 'Reference', 'Amount']
    const rows = payments.map((p) => [
      (p.invoices as any)?.invoice_number ?? '',
      (p.customers as any)?.company || (p.customers as any)?.name || '',
      p.payment_date,
      p.method,
      p.reference ?? '',
      p.amount,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'payments.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <button onClick={exportCSV} className="btn-secondary">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Bar Chart */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-semibold text-slate-900 mb-4">Monthly Revenue (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyRevenue} barCategoryGap="30%">
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [fmt(Number(v)), 'Revenue']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="revenue" fill="#3b5bdb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie Chart */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Invoice Status</h2>
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusBreakdown.map((entry, i) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span className="text-xs capitalize">{value}</span>}
                />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 5 Customers */}
        <div className="card p-6 lg:col-span-3">
          <h2 className="font-semibold text-slate-900 mb-4">Top 5 Customers by Revenue</h2>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-slate-400">No payment data yet.</p>
          ) : (
            <div className="space-y-4">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-6 text-sm font-bold text-slate-400">{i + 1}</div>
                  <div className="w-44 shrink-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.company || c.name}</p>
                    {c.company && <p className="text-xs text-slate-500 truncate">{c.name}</p>}
                  </div>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3b5bdb] rounded-full transition-all"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                  <div className="w-28 text-right text-sm font-semibold text-slate-900">
                    {fmt(c.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
