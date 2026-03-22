'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DescriptionMaster } from '@/types'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'

export const dynamic = 'force-dynamic'

const UNITS = ['Nos', 'Pcs', 'Kg', 'Gm', 'Ltr', 'Ml', 'Mtr', 'Cm', 'Box', 'Set', 'Pair', 'Bag', 'Roll', 'Sheet', 'Dozen', 'Hours', 'Days']

const empty = { description: '', hsn_code: '', unit: 'Nos', rate: '' }

export default function DescriptionsPage() {
  const [items, setItems]       = useState<DescriptionMaster[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState<DescriptionMaster | null>(null)
  const [form, setForm]         = useState({ ...empty })
  const [saving, setSaving]     = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('descriptions')
      .select('*')
      .order('description')
    setItems((data as DescriptionMaster[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setForm({ ...empty })
    setShowModal(true)
  }

  function openEdit(item: DescriptionMaster) {
    setEditing(item)
    setForm({
      description: item.description,
      hsn_code:    item.hsn_code ?? '',
      unit:        item.unit,
      rate:        String(item.rate),
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.description.trim()) return alert('Description is required.')
    setSaving(true)
    const payload = {
      description: form.description.trim(),
      hsn_code:    form.hsn_code.trim() || null,
      unit:        form.unit,
      rate:        parseFloat(form.rate) || 0,
    }
    if (editing) {
      await supabase.from('descriptions').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('descriptions').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('descriptions').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  const filtered = items.filter((i) =>
    i.description.toLowerCase().includes(search.toLowerCase()) ||
    (i.hsn_code ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Description Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pre-define items/services for quick selection in invoices
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search description or HSN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-center">HSN Code</th>
              <th className="px-4 py-3 text-center">Unit</th>
              <th className="px-4 py-3 text-right">Default Rate (₹)</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {search ? 'No items match your search.' : 'No items yet. Click "Add Item" to start.'}
                </td>
              </tr>
            ) : (
              filtered.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.description}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">
                    {item.hsn_code || '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{item.unit}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {item.rate > 0 ? `₹ ${fmt(item.rate)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-[#3b5bdb] hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-lg">
                {editing ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Description *</label>
                <input
                  className="input"
                  placeholder="e.g. Topographical Survey"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">HSN Code</label>
                  <input
                    className="input font-mono"
                    placeholder="e.g. 998311"
                    value={form.hsn_code}
                    onChange={(e) => setForm({ ...form, hsn_code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select
                    className="input"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Default Rate (₹)</label>
                <input
                  className="input text-right"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editing ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900">Delete this item?</h3>
            <p className="text-sm text-slate-500">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
