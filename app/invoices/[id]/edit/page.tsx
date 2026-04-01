'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Customer, Settings, DescriptionMaster } from '@/types'
import { Plus, Trash2, Search, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const UNITS = ['Nos', 'Acers', 'Cents', 'Sqmt', 'Sqft', 'Months', 'Days', 'Hours', 'Pcs', 'Kg', 'Gm', 'Ltr', 'Ml', 'Mtr', 'Cm', 'Box', 'Set', 'Pair', 'Bag', 'Roll', 'Sheet', 'Dozen']

type LineItem = {
  id: string
  description: string
  hsn_code: string
  quantity: string
  unit: string
  rate: string
}

export default function EditInvoicePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading]             = useState(true)
  const [notFound, setNotFound]           = useState(false)
  const [notDraft, setNotDraft]           = useState(false)

  const [customers, setCustomers]         = useState<Customer[]>([])
  const [descMaster, setDescMaster]       = useState<DescriptionMaster[]>([])
  const [withGst, setWithGst]             = useState(true)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate]     = useState('')
  const [cgstRate, setCgstRate]           = useState(9)
  const [sgstRate, setSgstRate]           = useState(9)
  const [notes, setNotes]                 = useState('')
  const [items, setItems]                 = useState<LineItem[]>([])
  const [saving, setSaving]               = useState(false)

  // Customer search
  const [search, setSearch]               = useState('')
  const [showDropdown, setShowDropdown]   = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const searchRef                         = useRef<HTMLDivElement>(null)

  // Description search per row
  const [descSearch, setDescSearch]       = useState<Record<string, string>>({})
  const [descDropdown, setDescDropdown]   = useState<Record<string, boolean>>({})
  const descRefs                          = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    async function load() {
      const [{ data: inv }, { data: cust }, { data: desc }] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, customers(*), invoice_items(*)')
          .eq('id', id)
          .single(),
        supabase.from('customers').select('*').order('company'),
        supabase.from('descriptions').select('*').order('description'),
      ])

      if (!inv) { setNotFound(true); setLoading(false); return }
      if (inv.status !== 'draft') { setNotDraft(true); setLoading(false); return }

      setCustomers((cust as Customer[]) ?? [])
      setDescMaster((desc as DescriptionMaster[]) ?? [])

      setWithGst(inv.with_gst ?? true)
      setInvoiceNumber(inv.invoice_number)
      setInvoiceDate(inv.issue_date ?? new Date().toISOString().split('T')[0])
      setCgstRate(inv.cgst_rate ?? 9)
      setSgstRate(inv.sgst_rate ?? 9)
      setNotes(inv.notes ?? '')

      // Pre-select customer
      const c = inv.customers as Customer
      if (c) {
        setSelectedCustomer(c)
        setSearch(c.company || c.name)
      }

      // Pre-fill line items
      const existingItems: LineItem[] = ((inv.invoice_items as any[]) ?? []).map((i: any) => ({
        id: i.id,
        description: i.description,
        hsn_code: i.hsn_code ?? '',
        quantity: String(i.quantity),
        unit: i.unit ?? 'Nos',
        rate: String(i.rate),
      }))
      setItems(existingItems.length > 0 ? existingItems : [
        { id: crypto.randomUUID(), description: '', hsn_code: '', quantity: '1', unit: 'Nos', rate: '' }
      ])

      // Init descSearch with existing descriptions
      const ds: Record<string, string> = {}
      existingItems.forEach((i) => { ds[i.id] = i.description })
      setDescSearch(ds)

      setLoading(false)
    }
    load()
  }, [id])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
      Object.entries(descRefs.current).forEach(([rowId, ref]) => {
        if (ref && !ref.contains(e.target as Node)) {
          setDescDropdown((prev) => ({ ...prev, [rowId]: false }))
        }
      })
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c)
    setSearch(c.company || c.name)
    setShowDropdown(false)
  }

  function selectDescription(rowId: string, item: DescriptionMaster) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === rowId
          ? { ...i, description: item.description, hsn_code: item.hsn_code ?? '', unit: item.unit ?? 'Nos', rate: String(item.rate) }
          : i
      )
    )
    setDescSearch((prev) => ({ ...prev, [rowId]: item.description }))
    setDescDropdown((prev) => ({ ...prev, [rowId]: false }))
  }

  function addItem() {
    setItems([...items, { id: crypto.randomUUID(), description: '', hsn_code: '', quantity: '1', unit: 'Nos', rate: '' }])
  }

  function removeItem(itemId: string) {
    setItems(items.filter((i) => i.id !== itemId))
  }

  function updateItem(itemId: string, field: keyof Omit<LineItem, 'id'>, value: string) {
    setItems(items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)))
  }

  const subtotal   = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0)
  const cgstAmount = withGst ? subtotal * cgstRate / 100 : 0
  const sgstAmount = withGst ? subtotal * sgstRate / 100 : 0
  const total      = subtotal + cgstAmount + sgstAmount

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n)

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase()
    return (c.company ?? '').toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  })

  async function handleSave() {
    if (!selectedCustomer) return alert('Please select a customer.')
    const validItems = items.filter((i) => i.description.trim())
    if (validItems.length === 0) return alert('Add at least one line item.')
    setSaving(true)

    // Update invoice
    const { error: invError } = await supabase
      .from('invoices')
      .update({
        customer_id:  selectedCustomer.id,
        issue_date:   invoiceDate,
        due_date:     invoiceDate,
        with_gst:     withGst,
        tax_rate:     withGst ? cgstRate + sgstRate : 0,
        cgst_rate:    withGst ? cgstRate : 0,
        sgst_rate:    withGst ? sgstRate : 0,
        notes:        notes || null,
        subtotal,
        cgst_amount:  cgstAmount,
        sgst_amount:  sgstAmount,
        tax_amount:   cgstAmount + sgstAmount,
        total,
      })
      .eq('id', id)

    if (invError) {
      alert('Error updating invoice: ' + invError.message)
      setSaving(false)
      return
    }

    // Delete existing items and re-insert
    await supabase.from('invoice_items').delete().eq('invoice_id', id)

    const { error: itemsError } = await supabase.from('invoice_items').insert(
      validItems.map((i) => {
        const qty  = parseFloat(i.quantity) || 1
        const rate = parseFloat(i.rate) || 0
        return {
          invoice_id:  id,
          description: i.description,
          hsn_code:    i.hsn_code || null,
          quantity:    qty,
          unit:        i.unit,
          rate,
          amount:      parseFloat((qty * rate).toFixed(2)),
        }
      })
    )

    if (itemsError) {
      alert('Invoice updated but line items failed: ' + itemsError.message)
    }

    router.push(`/invoices/${id}`)
  }

  // --- Loading / error states ---
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <p className="text-slate-400">Loading invoice...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-96 gap-4">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-slate-700 font-semibold">Invoice not found.</p>
        <button onClick={() => router.push('/invoices')} className="btn-secondary">Back to Invoices</button>
      </div>
    )
  }

  if (notDraft) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-96 gap-4">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="text-slate-700 font-semibold">Only Draft invoices can be edited.</p>
        <button onClick={() => router.push(`/invoices/${id}`)} className="btn-secondary">View Invoice</button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Edit Invoice</h1>
      <p className="text-sm text-slate-500 mb-6">Invoice: <span className="font-mono font-semibold text-slate-700">{invoiceNumber}</span></p>

      <div className="space-y-6">
        {/* GST Toggle + Invoice Header */}
        <div className="card p-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="radio" name="gst_type" checked={withGst} onChange={() => setWithGst(true)} className="w-4 h-4 accent-[#3b5bdb]" />
                <span className="text-sm font-medium text-slate-700">With GST</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="radio" name="gst_type" checked={!withGst} onChange={() => setWithGst(false)} className="w-4 h-4 accent-[#3b5bdb]" />
                <span className="text-sm font-medium text-slate-700">Without GST</span>
              </label>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="label">Invoice Number</label>
              <input className="input bg-slate-50 font-mono" value={invoiceNumber} readOnly />
            </div>

            <div>
              <label className="label">Invoice Date</label>
              <input type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
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
                  <button key={c.id} type="button"
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

          {selectedCustomer && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm space-y-0.5">
              <p className="font-semibold text-slate-900">{selectedCustomer.company || selectedCustomer.name}</p>
              {selectedCustomer.company && <p className="text-slate-600">{selectedCustomer.name}</p>}
              {selectedCustomer.gstin && <p className="text-slate-500 font-mono text-xs">GSTIN: {selectedCustomer.gstin}</p>}
              {selectedCustomer.address && <p className="text-slate-500 text-xs mt-1">{selectedCustomer.address}</p>}
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
                  <th className="py-2 pr-3 w-28">Ref No</th>
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
                        <div className="relative" ref={(el) => { descRefs.current[item.id] = el }}>
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                              className="input pl-8 pr-2"
                              placeholder="Search or type description..."
                              value={descSearch[item.id] ?? item.description}
                              onChange={(e) => {
                                const v = e.target.value
                                setDescSearch((p) => ({ ...p, [item.id]: v }))
                                updateItem(item.id, 'description', v)
                                setDescDropdown((p) => ({ ...p, [item.id]: true }))
                              }}
                              onFocus={() => setDescDropdown((p) => ({ ...p, [item.id]: true }))}
                            />
                          </div>
                          {descDropdown[item.id] && (
                            <div className="absolute z-30 top-full mt-1 left-0 w-72 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                              {descMaster
                                .filter((d) => d.description.toLowerCase().includes((descSearch[item.id] ?? '').toLowerCase()))
                                .map((d) => (
                                  <button key={d.id} type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-50 last:border-0"
                                    onMouseDown={(e) => { e.preventDefault(); selectDescription(item.id, d) }}
                                  >
                                    <p className="font-medium text-slate-900">{d.description}</p>
                                    <p className="text-xs text-slate-400">
                                      {d.rate > 0 ? `₹${d.rate}` : ''}
                                    </p>
                                  </button>
                                ))}
                              {descMaster.filter((d) =>
                                d.description.toLowerCase().includes((descSearch[item.id] ?? '').toLowerCase())
                              ).length === 0 && (
                                <p className="px-3 py-2 text-xs text-slate-400 italic">No match — using typed text</p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <input className="input font-mono text-xs" placeholder="Ref No"
                          value={item.hsn_code} onChange={(e) => updateItem(item.id, 'hsn_code', e.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <input className="input text-center" type="number" min="0" step="0.01"
                          value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <select className="input" value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)}>
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input className="input text-right" type="number" min="0" step="0.01" placeholder="0.00"
                          value={item.rate} onChange={(e) => updateItem(item.id, 'rate', e.target.value)} />
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-slate-900 whitespace-nowrap">{fmt(amount)}</td>
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
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-3">Notes / Bank Details</h2>
            <textarea className="input font-mono text-xs" rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

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
                    <input type="number" className="input w-20 text-right text-xs py-1" min="0" max="100" step="0.5"
                      value={cgstRate} onChange={(e) => setCgstRate(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST Amount</span><span>{fmt(cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">SGST %</span>
                    <input type="number" className="input w-20 text-right text-xs py-1" min="0" max="100" step="0.5"
                      value={sgstRate} onChange={(e) => setSgstRate(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST Amount</span><span>{fmt(sgstAmount)}</span>
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
          <button onClick={() => router.push(`/invoices/${id}`)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Update Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
