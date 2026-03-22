'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Pencil, Trash2, X, Save, ShieldCheck, Eye, EyeOff } from 'lucide-react'

export const dynamic = 'force-dynamic'

type User = {
  id: string
  username: string
  password: string
  created_at: string
}

type FormState = {
  username: string
  password: string
}

const empty: FormState = { username: '', password: '' }

export default function UsersPage() {
  const [users, setUsers]         = useState<User[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser]   = useState<User | null>(null)
  const [form, setForm]           = useState<FormState>(empty)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [deleteId, setDeleteId]   = useState<string | null>(null)

  // Current logged-in user (can't delete self)
  const session = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('billflow_session') ?? '{}')
    : {}

  async function load() {
    const { data } = await supabase.from('users').select('*').order('created_at')
    setUsers((data as User[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditUser(null)
    setForm(empty)
    setError('')
    setShowPwd(false)
    setShowModal(true)
  }

  function openEdit(u: User) {
    setEditUser(u)
    setForm({ username: u.username, password: u.password })
    setError('')
    setShowPwd(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditUser(null)
    setForm(empty)
    setError('')
  }

  async function handleSave() {
    if (!form.username.trim()) return setError('Username is required.')
    if (!form.password.trim()) return setError('Password is required.')
    if (form.password.length < 4) return setError('Password must be at least 4 characters.')
    setSaving(true)
    setError('')

    if (editUser) {
      // Update
      const { error: err } = await supabase
        .from('users')
        .update({ username: form.username.trim(), password: form.password })
        .eq('id', editUser.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      // Check duplicate username
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', form.username.trim())
        .single()
      if (existing) { setError('Username already exists.'); setSaving(false); return }

      const { error: err } = await supabase
        .from('users')
        .insert({ username: form.username.trim(), password: form.password })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    closeModal()
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('users').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage login accounts for BillFlow</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <th className="px-6 py-3">Username</th>
              <th className="px-6 py-3">Password</th>
              <th className="px-6 py-3">Created</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#3b5bdb]/10 flex items-center justify-center">
                      <span className="text-[#3b5bdb] font-bold text-xs">
                        {u.username[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium text-slate-900">{u.username}</span>
                    {u.username === session?.username && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        You
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-slate-400 text-xs tracking-widest">
                  {'•'.repeat(Math.min(u.password.length, 10))}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {new Date(u.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-2 text-slate-400 hover:text-[#3b5bdb] hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(u.id)}
                      disabled={u.username === session?.username}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={u.username === session?.username ? "Can't delete your own account" : 'Delete'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info box */}
      <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
        <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
        <p>
          Each user&apos;s name is recorded on every invoice and payment they create.
          You cannot delete your own account while logged in.
        </p>
      </div>

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-lg">
                {editUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Username *</label>
                <input
                  className="input"
                  placeholder="e.g. john"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Password *</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Minimum 4 characters"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                <Save size={15} /> {saving ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900 text-lg mb-2">Delete User?</h3>
            <p className="text-slate-500 text-sm mb-6">
              This user will no longer be able to log in. Past transactions created by them will still show their name.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger">
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
