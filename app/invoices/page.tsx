'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Invoice, InvoiceStatus } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { Plus, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
]

const STATUS_OPTIONS: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled']

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const query = supabase
      .from('invoices')
      .select('*, customers(name, company)')
      .order('created_at', { ascending: false })

    const { data } = tab === 'all' ? await query : await query.eq('status', tab)
    setInvoices((data as Invoice[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  async function updateStatus(id: string, status: InvoiceStatus) {
    await supabase.from('invoices').update({ status }).eq('id', id)
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status } : inv)))
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <Link href="/invoices/new" className="btn-primary">
          <Plus size={16} /> New Invoice
        </Link>
      </div>

      <div className="card">
        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          {TABS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                tab === value
                  ? 'border-[#3b5bdb] text-[#3b5bdb]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Issue Date</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    No invoices found.{' '}
                    <Link href="/invoices/new" className="text-[#3b5bdb] hover:underline">Create one</Link>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-[#3b5bdb]">
                      <Link href={`/invoices/${inv.id}`}>{inv.invoice_number}</Link>
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {(inv.customers as any)?.company || (inv.customers as any)?.name || '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{inv.issue_date}</td>
                    <td className="px-6 py-3 text-slate-600">{inv.due_date}</td>
                    <td className="px-6 py-3 font-semibold text-slate-900">{fmt(inv.total)}</td>
                    <td className="px-6 py-3">
                      <select
                        value={inv.status}
                        onChange={(e) => updateStatus(inv.id, e.target.value as InvoiceStatus)}
                        className="text-xs rounded-full px-2.5 py-1 border-0 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]"
                        style={{ background: 'transparent' }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-6 py-3">
                      <Link href={`/invoices/${inv.id}`} className="p-1.5 rounded hover:bg-slate-100 text-slate-600 inline-flex" title="View">
                        <Eye size={15} />
                      </Link>
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
