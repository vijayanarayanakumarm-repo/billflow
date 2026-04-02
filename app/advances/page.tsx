'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, SalaryAdvance } from '@/types'
import {
  Plus, X, Trash2, CheckCircle, Search, ChevronLeft, ChevronRight, Banknote,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]/30 focus:border-[#3b5bdb]'

type AdvanceRow = SalaryAdvance & { employee: Employee }

const emptyForm = { employee_id: '', amount: '', reason: '' }

export default function AdvancesPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [rows, setRows]           = useState<AdvanceRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState({ ...emptyForm })
  const [saving, setSaving]       = useState(false)
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [payingId, setPayingId]   = useState<string | null>(null)
  const [search, setSearch]       = useState('')

  const monthStr   = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  // ── Load ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: emps }, { data: advs }] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active').order('name'),
      supabase.from('salary_advances').select('*').eq('month', monthStr).order('created_at', { ascending: false }),
    ])
    const empList = (emps as Employee[]) ?? []
    setEmployees(empList)
    const advList = ((advs as SalaryAdvance[]) ?? [])
      .map((a) => ({ ...a, employee: empList.find((e) => e.id === a.employee_id) as Employee }))
      .filter((a) => a.employee)
    setRows(advList)
    setLoading(false)
  }, [monthStr])

  useEffect(() => { loadData() }, [loadData])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) } else setMonth((m) => m + 1)
  }

  // ── Add Advance ───────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.employee_id) return alert('Please select an employee.')
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) return alert('Enter a valid advance amount.')

    const emp = employees.find((e) => e.id === form.employee_id)
    if (!emp) return

    // Sum of existing advances for this employee this month
    const existingTotal = rows
      .filter((r) => r.employee_id === form.employee_id)
      .reduce((s, r) => s + r.amount, 0)

    if (existingTotal + amt > emp.monthly_salary) {
      return alert(
        `Total advances for ${emp.name} in ${monthLabel} would be ₹ ${fmt(existingTotal + amt)}, ` +
        `which exceeds their monthly salary of ₹ ${fmt(emp.monthly_salary)}.\n\n` +
        `Already given: ₹ ${fmt(existingTotal)} · Remaining: ₹ ${fmt(emp.monthly_salary - existingTotal)}`
      )
    }

    setSaving(true)
    const { error } = await supabase.from('salary_advances').insert({
      employee_id: form.employee_id,
      amount:      amt,
      month:       monthStr,
      reason:      form.reason.trim() || null,
      status:      'pending',
    })
    if (error) alert('Error: ' + error.message)
    else {
      setShowModal(false)
      setForm({ ...emptyForm })
      await loadData()
    }
    setSaving(false)
  }

  // ── Mark Paid ─────────────────────────────────────────────────────────
  async function markPaid(id: string) {
    setPayingId(id)
    await supabase.from('salary_advances').update({ status: 'paid' }).eq('id', id)
    await loadData()
    setPayingId(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await supabase.from('salary_advances').delete().eq('id', id)
    setDeleteId(null)
    await loadData()
  }

  // ── Filter / Totals ───────────────────────────────────────────────────
  const filtered = rows.filter((r) =>
    r.employee.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.reason ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalAdvances = rows.reduce((s, r) => s + r.amount, 0)
  const totalPaid     = rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
  const totalPending  = rows.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0)

  // Per-employee totals for the selected month (for validation hint in modal)
  const selectedEmp  = employees.find((e) => e.id === form.employee_id)
  const empMonthTotal = rows
    .filter((r) => r.employee_id === form.employee_id)
    .reduce((s, r) => s + r.amount, 0)
  const remaining = selectedEmp ? selectedEmp.monthly_salary - empMonthTotal : 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salary Advances</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage advance payments · Total advances per month cannot exceed employee&apos;s monthly salary
          </p>
        </div>
        <button onClick={() => { setForm({ ...emptyForm }); setShowModal(true) }} className="btn-primary">
          <Plus size={16} /> Add Advance
        </button>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
          <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
            <ChevronLeft size={18} />
          </button>
          <span className="px-4 py-1 font-semibold text-slate-800 min-w-[160px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
            <ChevronRight size={18} />
          </button>
        </div>
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search employee, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Advances</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">₹ {fmt(totalAdvances)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{rows.length} record(s)</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Paid</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">₹ {fmt(totalPaid)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{rows.filter((r) => r.status === 'paid').length} record(s)</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">₹ {fmt(totalPending)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{rows.filter((r) => r.status === 'pending').length} record(s)</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-right">Monthly Salary</th>
              <th className="px-4 py-3 text-right">Advance Amount</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {search ? 'No records match your search.' : `No advances recorded for ${monthLabel}.`}
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{row.employee.name}</p>
                    {row.employee.designation && (
                      <p className="text-xs text-slate-400">{row.employee.designation}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">₹ {fmt(row.employee.monthly_salary)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">₹ {fmt(row.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{row.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      row.status === 'paid'     ? 'bg-emerald-50 text-emerald-700' :
                      row.status === 'adjusted' ? 'bg-blue-50 text-blue-700' :
                                                  'bg-amber-50 text-amber-700'
                    }`}>
                      {row.status === 'paid' && <CheckCircle size={11} />}
                      {row.status === 'paid' ? 'Paid' : row.status === 'adjusted' ? 'Salary Adjusted' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {row.status === 'pending' && (
                        <button
                          onClick={() => markPaid(row.id)}
                          disabled={payingId === row.id}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {payingId === row.id ? 'Saving...' : 'Mark Paid'}
                        </button>
                      )}
                      {row.status === 'pending' && (
                        <button
                          onClick={() => setDeleteId(row.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {row.status !== 'pending' && (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-slate-800 text-white">
                <td className="px-4 py-3 font-bold" colSpan={3}>Total — {monthLabel}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-300">₹ {fmt(totalAdvances)}</td>
                <td colSpan={3} className="px-4 py-3 text-xs text-slate-300 text-center">
                  {rows.filter((r) => r.status === 'paid').length} paid · {rows.filter((r) => r.status === 'pending').length} pending
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Banknote size={20} className="text-[#3b5bdb]" />
                <h2 className="font-semibold text-slate-900 text-lg">Add Salary Advance</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Employee */}
              <div>
                <label className="label">Employee *</label>
                <select
                  className={inputClass}
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}{e.designation ? ` — ${e.designation}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Salary info */}
              {selectedEmp && (
                <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monthly Salary</span>
                    <span className="font-semibold text-slate-800">₹ {fmt(selectedEmp.monthly_salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Already Advanced ({monthLabel})</span>
                    <span className="font-semibold text-amber-700">₹ {fmt(empMonthTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                    <span className="text-slate-500 font-medium">Remaining Limit</span>
                    <span className={`font-bold ${remaining <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ₹ {fmt(remaining)}
                    </span>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="label">Advance Amount (₹) *</label>
                <input
                  className={inputClass + ' text-right'}
                  type="number" min="1" step="100"
                  placeholder={selectedEmp ? `Max ₹ ${fmt(remaining)}` : '0.00'}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              {/* Reason */}
              <div>
                <label className="label">Reason</label>
                <input
                  className={inputClass}
                  placeholder="Medical, Personal, Emergency..."
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              <p className="text-xs text-slate-400">
                Month: <strong>{monthLabel}</strong> · Advances will be deducted automatically during salary calculation.
              </p>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Add Advance'}
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
            <h3 className="font-semibold text-slate-900">Delete this advance?</h3>
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
