'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee } from '@/types'
import { Plus, Pencil, Trash2, Search, X, UserCheck, UserX } from 'lucide-react'

export const dynamic = 'force-dynamic'

const emptyForm = {
  employee_code: '', name: '', designation: '', department: '',
  phone: '', email: '', address: '',
  date_of_birth: '', date_of_joining: '',
  monthly_salary: '',
  bank_name: '', account_number: '', ifsc_code: '', pan_number: '',
  status: 'active',
}

const DEPARTMENTS = ['Management', 'Engineering', 'Accounts', 'Survey', 'Admin', 'Field', 'IT', 'HR', 'Other']

const inputClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]/30 focus:border-[#3b5bdb]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function EmployeesPage() {
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active')
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<Employee | null>(null)
  const [form, setForm]               = useState({ ...emptyForm })
  const [saving, setSaving]           = useState(false)
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [activeTab, setActiveTab]     = useState<'personal' | 'salary' | 'bank'>('personal')


  async function load() {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('name')
    setEmployees((data as Employee[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm })
    setActiveTab('personal')
    setShowModal(true)
  }

  function openEdit(emp: Employee) {
    setEditing(emp)
    setForm({
      employee_code:  emp.employee_code ?? '',
      name:           emp.name,
      designation:    emp.designation ?? '',
      department:     emp.department ?? '',
      phone:          emp.phone ?? '',
      email:          emp.email ?? '',
      address:        emp.address ?? '',
      date_of_birth:  emp.date_of_birth ?? '',
      date_of_joining: emp.date_of_joining ?? '',
      monthly_salary: String(emp.monthly_salary),
      bank_name:      emp.bank_name ?? '',
      account_number: emp.account_number ?? '',
      ifsc_code:      emp.ifsc_code ?? '',
      pan_number:     emp.pan_number ?? '',
      status:         emp.status,
    })
    setActiveTab('personal')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('Employee name is required.')
    setSaving(true)
    const payload = {
      employee_code:   form.employee_code.trim() || null,
      name:            form.name.trim(),
      designation:     form.designation.trim() || null,
      department:      form.department.trim() || null,
      phone:           form.phone.trim() || null,
      email:           form.email.trim() || null,
      address:         form.address.trim() || null,
      date_of_birth:   form.date_of_birth || null,
      date_of_joining: form.date_of_joining || null,
      monthly_salary:  parseFloat(form.monthly_salary) || 0,
      bank_name:       form.bank_name.trim() || null,
      account_number:  form.account_number.trim() || null,
      ifsc_code:       form.ifsc_code.trim() || null,
      pan_number:      form.pan_number.trim() || null,
      status:          form.status,
    }
    if (editing) {
      await supabase.from('employees').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('employees').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('employees').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  const filtered = employees.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.employee_code ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.department ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.designation ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' ? true : e.status === filterStatus
    return matchSearch && matchStatus
  })

  const tabClass = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === t ? 'bg-[#3b5bdb] text-white' : 'text-slate-500 hover:text-slate-800'
    }`

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage employee demographics and salary information</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search name, code, department..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 font-medium transition-colors capitalize ${filterStatus === s ? 'bg-[#3b5bdb] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total', count: employees.length, color: 'text-slate-700' },
          { label: 'Active', count: employees.filter((e) => e.status === 'active').length, color: 'text-emerald-600' },
          { label: 'Inactive', count: employees.filter((e) => e.status === 'inactive').length, color: 'text-red-500' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label} Employees</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Designation</th>
              <th className="px-4 py-3 text-left">Department</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-right">Monthly Salary</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No employees found.</td></tr>
            ) : filtered.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{emp.employee_code ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{emp.name}</td>
                <td className="px-4 py-3 text-slate-600">{emp.designation ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{emp.department ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{emp.phone ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">₹ {fmt(emp.monthly_salary)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                  }`}>
                    {emp.status === 'active' ? <UserCheck size={11} /> : <UserX size={11} />}
                    {emp.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(emp)} className="p-1.5 text-slate-400 hover:text-[#3b5bdb] hover:bg-blue-50 rounded" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteId(emp.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="font-semibold text-slate-900 text-lg">
                {editing ? 'Edit Employee' : 'Add New Employee'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-6 pt-4 flex-shrink-0">
              <button className={tabClass('personal')} onClick={() => setActiveTab('personal')}>Personal Info</button>
              <button className={tabClass('salary')} onClick={() => setActiveTab('salary')}>Salary</button>
              <button className={tabClass('bank')} onClick={() => setActiveTab('bank')}>Bank Details</button>
            </div>

            {/* Form */}
            <div className="p-6 overflow-y-auto flex-1">
              {activeTab === 'personal' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Employee Code">
                    <input className={inputClass} placeholder="EMP001" value={form.employee_code}
                      onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
                  </Field>
                  <Field label="Full Name *">
                    <input className={inputClass} placeholder="John Doe" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label="Designation">
                    <input className={inputClass} placeholder="Survey Engineer" value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                  </Field>
                  <Field label="Department">
                    <select className={inputClass} value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Phone">
                    <input className={inputClass} placeholder="9876543210" value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <input className={inputClass} type="email" placeholder="john@example.com" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </Field>
                  <Field label="Date of Birth">
                    <input className={inputClass} type="date" value={form.date_of_birth}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                  </Field>
                  <Field label="Date of Joining">
                    <input className={inputClass} type="date" value={form.date_of_joining}
                      onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Address">
                      <textarea className={inputClass} rows={2} placeholder="Full address" value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Status">
                    <select className={inputClass} value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </Field>
                </div>
              )}

              {activeTab === 'salary' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Monthly Salary (₹)">
                      <input className={inputClass + ' text-right text-lg font-semibold'} type="number" min="0" step="100"
                        placeholder="0.00" value={form.monthly_salary}
                        onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="PAN Number">
                    <input className={inputClass + ' font-mono uppercase'} placeholder="ABCDE1234F" value={form.pan_number}
                      onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })} />
                  </Field>
                </div>
              )}

              {activeTab === 'bank' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bank Name">
                    <input className={inputClass} placeholder="State Bank of India" value={form.bank_name}
                      onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                  </Field>
                  <Field label="Account Number">
                    <input className={inputClass + ' font-mono'} placeholder="1234567890" value={form.account_number}
                      onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
                  </Field>
                  <Field label="IFSC Code">
                    <input className={inputClass + ' font-mono uppercase'} placeholder="SBIN0012345" value={form.ifsc_code}
                      onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} />
                  </Field>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editing ? 'Update Employee' : 'Add Employee'}
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
            <h3 className="font-semibold text-slate-900">Delete this employee?</h3>
            <p className="text-sm text-slate-500">All attendance and salary records will also be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
