'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Customer, Settings } from '@/types'
import { Plus, Trash2, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

const UNITS = ['Nos', 'Pcs', 'Kg', 'Gm', 'Ltr', 'Ml', 'Mtr', 'Cm', 'Box', 'Set', 'Pair', 'Bag', 'Roll', 'Sheet', 'Dozen', 'Hours', 'Days']

type LineItem = {
  id: string
  description: string
  hsn_code: string
  quantity: string
  unit: string
  rate: string
}

function buildAccountNotes(s: Settings): string {
  const lines = []
  if (s.account_name)  lines.push(`Account Name   : ${s.account_name}`)
  if (s.bank_name)     lines.push(`Bank           : ${s.bank_name}`)
  if (s.branch)        lines.push(`Branch         : ${s.branch}`)
  if (s.account_number) lines.push(`Account No     : ${s.account_number}`)
  if (s.ifsc_code)     lines.push(`IFSC Code      : ${s.ifsc_code}`)
  return lines.join('\n')
}

function NewInvoiceForm() {
  const router = useRouter()
  const params = useSearchParams()
  const prefillCustomerId = params.get('customer_id') ?? ''

  const [customers, setCustomers] = useState<Customer[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [withGst, setWithGst] = useState(true)

  // Customer search
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [cgstRate, setCgstRate] = useState(9)
  const [sgstRate, setSgstRate] = useState(9)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', hsn_code: '', quantity: '1', unit: 'Nos', rate: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [generatingNum, setGeneratingNum] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: cust }, { data: s }] = await Promise.all([
        supabase.from('customers').select('*').order('company'),
        supabase.from('settings').select('*').single(),
      ])
      const custList = (cust as Customer[]) ?? []
      setCustomers(custList)

      if (s) {
        setSettings(s as Settings)
        setCgstRate(s.default_cgst ?? 9)
        setSgstRate(s.default_sgst ?? 9)
        setNotes(buildAccountNotes(s as Settings))

        // Prefill customer
        if (prefillCustomerId) {
          const c = custList.find((x) => x.id === prefillCustomerId)
          if (c) { setSelectedCustomer(c); setSearch(c.company || c.name) }
        }
      }
    }
    load()
  }, [prefillCustomerId])

  // Auto-generate invoice number whenever withGst or settings changes
  useEffect(() => {
    if (!settings) return
    generateInvoiceNumber(withGst)
  }, [withGst, settings])

  function getFinancialYear(): string {
    const now = new Date()
    const month = now.getMonth() + 1   // 1-based
    const year  = now.getFullYear()
    const fyStart = month >= 4 ? year : year - 1
    const fyEnd   = fyStart + 1
    return `${String(fyStart).slice(2)}-${String(fyEnd).slice(2)}`   // e.g. "25-26"
  }

  async function generateInvoiceNumber(gst: boolean) {
    if (!settings) return
    setGeneratingNum(true)
    const prefix = gst
      ? (settings.invoice_prefix_gst     || 'GST')
      : (settings.invoice_prefix_non_gst || 'INV')
    const fy = getFinancialYear()
    const fullPrefix = `${prefix}/${fy}/`
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .like('invoice_number', `${fullPrefix}%`)
    const num = String((count ?? 0) + 1).padStart(4, '0')
    setInvoiceNumber(`${fullPrefix}${num}`)
    setGeneratingNum(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase()
    return (c.company ?? '').toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  })

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c)
    setSearch(c.company || c.name)
    setShowDropdown(false)
  }

  function addItem() {
    setItems([...items, { id: crypto.randomUUID(), description: '', hsn_code: '', quantity: '1', unit: 'Nos', rate: '' }])
  }

  function removeItem(id: string) {
    setItems(items.filter((i) => i.id !== id))
  }

  function updateItem(id: string, field: keyof Omit<LineItem, 'id'>, value: string) {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0)
  const cgstAmount = withGst ? subtotal * cgstRate / 100 : 0
  const sgstAmount = withGst ? subtotal * sgstRate / 100 : 0
  const total = subtotal + cgstAmount + sgstAmount

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n)

  async function handleSave() {
    if (!selectedCustomer) return alert('Please select a customer.')
    const validItems = items.filter((i) => i.description.trim())
    if (validItems.length === 0) return alert('Add at least one line item.')
    setSaving(true)

    const session = JSON.parse(localStorage.getItem('billflow_session') ?? '{}')
    const createdBy = session?.username ?? ''

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_id: selectedCustomer.id,
        status: 'draft',
        issue_date: invoiceDate,
        due_date: invoiceDate,
        with_gst: withGst,
        tax_rate: cgstRate + sgstRate,
        cgst_rate: cgstRate,
        sgst_rate: sgstRate,
        notes: notes || null,
        subtotal,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        tax_amount: cgstAmount + sgstAmount,
        total,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error || !inv) {
      alert('Error creating invoice: ' + error?.message)
      setSaving(false)
      return
    }

    const { error: itemsError } = await supabase.from('invoice_items').insert(
      validItems.map((i) => {
        const qty = parseFloat(i.quantity) || 1
        const rate = parseFloat(i.rate) || 0
        return {
          invoice_id: inv.id,
          description: i.description,
          hsn_code: i.hsn_code || null,
          quantity: qty,
          unit: i.unit,
          rate,
          amount: parseFloat((qty * rate).toFixed(2)),
        }
      })
    )

    if (itemsError) {
      console.error('Error saving line items:', itemsError)
      alert('Invoice saved but line items failed: ' + itemsError.message)
    }

    router.push(`/invoices/${inv.id}`)
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">New Invoice</h1>

      <div className="space-y-6">
        {/* GST Toggle + Invoice Header */}
        <div className="card p-6">
          <div className="flex flex-wrap items-start gap-6">
            {/* GST Toggle */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="gst_type"
                  checked={withGst}
                  onChange={() => setWithGst(true)}
                  className="w-4 h-4 accent-[#3b5bdb]"
                />
                <span className="text-sm font-medium text-slate-700">With GST</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="gst_type"
                  checked={!withGst}
                  onChange={() => setWithGst(false)}
                  className="w-4 h-4 accent-[#3b5bdb]"
                />
                <span className="text-sm font-medium text-slate-700">Without GST</span>
              </label>
            </div>

            {/* Invoice Number */}
            <div className="flex-1 min-w-[200px]">
              <label className="label">Invoice Number</label>
              <input
                className="input bg-slate-50 font-mono"
                value={generatingNum ? 'Generating...' : invoiceNumber}
                readOnly
              />
            </div>

            {/* Invoice Date */}
            <div>
              <label className="label">Invoice Date</label>
              <input
                type="date"
                className="input"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Customer Search */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Customer</h2>
          <div ref={searchRef} className="relative max-w-md">
            <label className="label">Search & Select Customer *</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Type company or contact name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setSelectedCustomer(null) }}
                onFocus={() => setShowDropdown(true)}
              />
            </div>
            {showDropdown && filteredCustomers.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
                    onClick={() => selectCustomer(c)}
                  >
                    <span className="font-medium text-slate-900">{c.company || c.name}</span>
                    {c.company && <span className="text-slate-400 ml-2">({c.name})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected customer details */}
          {selectedCustomer && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm space-y-0.5">
              <p className="font-semibold text-slate-900">{selectedCustomer.company || selectedCustomer.name}</p>
              {selectedCustomer.company && <p className="text-slate-600">{selectedCustomer.name}</p>}
              {selectedCustomer.gstin && <p className="text-slate-500 font-mono text-xs">GSTIN: {selectedCustomer.gstin}</p>}
              {selectedCustomer.address && <p className="text-slate-500 text-xs mt-1">{selectedCustomer.address}</p>}
              {selectedCustomer.phone && <p className="text-slate-500 text-xs">{selectedCustomer.phone}</p>}
              {selectedCustomer.email && <p className="text-slate-500 text-xs">{selectedCustomer.email}</p>}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Line Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-100">
                  <th className="py-2 pr-3 w-10">Sl.No</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3 w-28">HSN Code</th>
                  <th className="py-2 pr-3 w-20">QTY</th>
                  <th className="py-2 pr-3 w-28">Unit</th>
                  <th className="py-2 pr-3 w-28">Rate (₹)</th>
                  <th className="py-2 pr-3 w-32 text-right">Amount</th>
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)
                  return (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="py-2 pr-3 text-slate-400 text-center">{idx + 1}</td>
                      <td className="py-2 pr-3">
                        <input
                          className="input"
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          className="input font-mono text-xs"
                          placeholder="HSN"
                          value={item.hsn_code}
                          onChange={(e) => updateItem(item.id, 'hsn_code', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          className="input text-center"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          className="input"
                          value={item.unit}
                          onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                        >
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          className="input text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-slate-900 whitespace-nowrap">
                        {fmt(amount)}
                      </td>
                      <td className="py-2">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button onClick={addItem} className="btn-secondary mt-4">
            <Plus size={14} /> Add Line Item
          </button>
        </div>

        {/* Summary + Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Notes */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-3">Notes / Bank Details</h2>
            <textarea
              className="input font-mono text-xs"
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Summary */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Sub Total</span>
                <span className="font-semibold text-slate-900">{fmt(subtotal)}</span>
              </div>

              {withGst && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">CGST %</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="input w-20 text-right text-xs py-1"
                        min="0" max="100" step="0.5"
                        value={cgstRate}
                        onChange={(e) => setCgstRate(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST Amount</span>
                    <span>{fmt(cgstAmount)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">SGST %</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="input w-20 text-right text-xs py-1"
                        min="0" max="100" step="0.5"
                        value={sgstRate}
                        onChange={(e) => setSgstRate(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST Amount</span>
                    <span>{fmt(sgstAmount)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between pt-3 border-t-2 border-slate-200">
                <span className="font-bold text-slate-900 text-base">Total Amount</span>
                <span className="font-bold text-xl text-[#3b5bdb]">{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoiceForm />
    </Suspense>
  )
}
