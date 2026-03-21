'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Payment, Invoice, PaymentMethod } from '@/types'
import { Plus, X } from 'lucide-react'

const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  bank_transfer: 'bg-blue-100 text-blue-700',
  upi: 'bg-purple-100 text-purple-700',
  cash: 'bg-green-100 text-green-700',
  cheque: 'bg-orange-100 text-orange-700',
  card: 'bg-indigo-100 text-indigo-700',
  other: 'bg-slate-100 text-slate-600',
}

type FormState = {
  invoice_id: string
  amount: string
  payment_date: string
  method: PaymentMethod
  reference: string
  notes: string
}

const emptyForm: FormState = {
  invoice_id: '',
  amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  method: 'bank_transfer',
  reference: '',
  notes: '',
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: p } = await supabase
      .from('payments')
      .select('*, invoices(invoice_number), customers(name, company)')
      .order('created_at', { ascending: false })
    setPayments((p as Payment[]) ?? [])
    setLoading(false)
  }

  async function loadUnpaid() {
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(name, company)')
      .in('status', ['draft', 'sent', 'overdue'])
      .order('due_date')
    setUnpaidInvoices((data as Invoice[]) ?? [])
  }

  useEffect(() => { load() }, [])

  function openModal() {
    loadUnpaid()
    setForm(emptyForm)
    setShowModal(true)
  }

  function handleInvoiceSelect(invoiceId: string) {
    const inv = unpaidInvoices.find((i) => i.id === invoiceId)
    setForm((f) => ({ ...f, invoice_id: invoiceId, amount: inv ? String(inv.total) : '' }))
  }

  async function handleSave() {
    if (!form.invoice_id || !form.amount) return
    setSaving(true)

    const inv = unpaidInvoices.find((i) => i.id === form.invoice_id)
    if (!inv) { setSaving(false); return }

    const session = JSON.parse(localStorage.getItem('billflow_session') ?? '{}')
    const createdBy = session?.username ?? ''

    await supabase.from('payments').insert({
      invoice_id: form.invoice_id,
      customer_id: inv.customer_id,
      amount: parseFloat(form.amount),
      payment_date: form.payment_date,
      method: form.method,
      reference: form.reference || null,
      notes: form.notes || null,
      created_by: createdBy,
    })

    // Mark invoice as paid
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', form.invoice_id)

    setSaving(false)
    setShowModal(false)
    load()
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <button onClick={openModal} className="btn-primary">
          <Plus size={16} /> Record Payment
        </button>
      </div>

      {/* Summary */}
      <div className="card p-5 mb-6 inline-block">
        <p className="text-sm text-slate-500 mb-1">Total Received</p>
        <p className="text-2xl font-bold text-green-600">{fmt(totalPaid)}</p>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Reference</th>
                <th className="px-6 py-3">Created By</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">No payments recorded yet.</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-[#3b5bdb]">
                      {(p.invoices as any)?.invoice_number ?? '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {(p.customers as any)?.company || (p.customers as any)?.name || '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{p.payment_date}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${METHOD_COLORS[p.method]}`}>
                        {METHOD_LABELS[p.method]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{p.reference ?? '—'}</td>
                    <td className="px-6 py-3">
                      {(p as any).created_by ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          <span className="w-4 h-4 rounded-full bg-[#3b5bdb] text-white flex items-center justify-center text-[9px] font-bold">
                            {(p as any).created_by[0]?.toUpperCase()}
                          </span>
                          {(p as any).created_by}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-green-600">{fmt(Number(p.amount))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Record Payment</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Invoice *</label>
                <select
                  className="input"
                  value={form.invoice_id}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                >
                  <option value="">Select invoice...</option>
                  {unpaidInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {(inv.customers as any)?.company || (inv.customers as any)?.name} (
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(inv.total)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount (₹) *</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Payment Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
                  {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Reference / UTR</label>
                <input className="input" placeholder="Transaction ID, cheque no..." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.invoice_id || !form.amount}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
