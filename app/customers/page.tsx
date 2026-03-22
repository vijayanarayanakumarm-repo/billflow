'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Customer } from '@/types'
import { Plus, Search, Pencil, Trash2, FileText, X } from 'lucide-react'

export const dynamic = 'force-dynamic'

type FormData = {
  company: string
  name: string
  address: string
  gstin: string
  phone: string
  email: string
}

const emptyForm: FormData = { company: '', name: '', address: '', gstin: '', phone: '', email: '' }

export default function Customers() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    setCustomers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      (c.company ?? '').toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.gstin ?? '').toLowerCase().includes(q)
    )
  })

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(c: Customer) {
    setEditingId(c.id)
    setForm({
      company: c.company ?? '',
      name: c.name,
      address: c.address ?? '',
      gstin: c.gstin ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.company.trim()) return
    setSaving(true)
    if (editingId) {
      await supabase.from('customers').update(form).eq('id', editingId)
    } else {
      await supabase.from('customers').insert(form)
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('customers').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="card">
        {/* Search */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
          <Search size={16} className="text-slate-400" />
          <input
            className="flex-1 outline-none text-sm text-slate-900 placeholder-slate-400"
            placeholder="Search by company, contact person, email or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-6 py-3">Company Name</th>
                <th className="px-6 py-3">Contact Person</th>
                <th className="px-6 py-3">GSTIN</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">No customers found.</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{c.company ?? '—'}</td>
                    <td className="px-6 py-3 text-slate-700">{c.name || '—'}</td>
                    <td className="px-6 py-3 text-slate-600 font-mono text-xs">{c.gstin ?? '—'}</td>
                    <td className="px-6 py-3 text-slate-600">{c.phone ?? '—'}</td>
                    <td className="px-6 py-3 text-slate-600">{c.email ?? '—'}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/invoices/new?customer_id=${c.id}`)}
                          className="p-1.5 rounded hover:bg-blue-50 text-[#3b5bdb]"
                          title="Create Invoice"
                        >
                          <FileText size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{editingId ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Company Name *</label>
                <input
                  className="input"
                  placeholder="Acme Pvt Ltd"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Contact Person</label>
                <input
                  className="input"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Street, City, State, PIN"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div>
                <label className="label">GSTIN No</label>
                <input
                  className="input font-mono"
                  placeholder="22AAAAA0000A1Z5"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Phone No</label>
                  <input
                    className="input"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="john@acme.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.company.trim()} className="btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-2">Delete Customer?</h2>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
