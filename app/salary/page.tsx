'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, SalaryRecord, SalaryAdvance } from '@/types'
import { Calculator, ChevronLeft, ChevronRight, CheckCircle, Download } from 'lucide-react'

export const dynamic = 'force-dynamic'

type SalaryRow = SalaryRecord & { employee: Employee }

export default function SalaryPage() {
  const now = new Date()
  const [year, setYear]             = useState(now.getFullYear())
  const [month, setMonth]           = useState(now.getMonth() + 1)
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [payingId, setPayingId]     = useState<string | null>(null)
  const [attWarnings, setAttWarnings] = useState<string[]>([])

  // Derived values — recomputed on every render so always current
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthStr    = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel  = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  // ── Load salary records ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: emps }, { data: sal }] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active').order('name'),
      supabase.from('salary_records').select('*').eq('month', monthStr),
    ])
    const empList = (emps as Employee[]) ?? []
    setEmployees(empList)

    const rows: SalaryRow[] = ((sal as SalaryRecord[]) ?? [])
      .map((s) => ({ ...s, employee: empList.find((e) => e.id === s.employee_id) as Employee }))
      .filter((s) => s.employee)
    setSalaryRows(rows)
    setLoading(false)
  }, [monthStr])

  useEffect(() => { loadData() }, [loadData])

  function prevMonth() {
    setAttWarnings([])
    if (month === 1) { setMonth(12); setYear((y) => y - 1) } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    setAttWarnings([])
    if (month === 12) { setMonth(1); setYear((y) => y + 1) } else setMonth((m) => m + 1)
  }

  // ── Calculate salary ──────────────────────────────────────────────────
  async function calculateSalaries() {
    setCalculating(true)

    // Always fetch fresh data — do NOT rely on stale state
    const { data: empData, error: empErr } = await supabase
      .from('employees').select('*').eq('status', 'active')

    if (empErr || !empData || empData.length === 0) {
      alert('No active employees found. Please add employees first.')
      setCalculating(false)
      return
    }

    const lastDay = String(daysInMonth).padStart(2, '0')

    // Fetch attendance, govt holidays, and pending advances together
    const [{ data: attData, error: attErr }, { data: holData }, { data: advData }] = await Promise.all([
      supabase.from('attendance')
        .select('employee_id, date, status')
        .gte('date', `${monthStr}-01`)
        .lte('date', `${monthStr}-${lastDay}`),
      supabase.from('holidays')
        .select('date')
        .gte('date', `${monthStr}-01`)
        .lte('date', `${monthStr}-${lastDay}`),
      supabase.from('salary_advances')
        .select('*')
        .eq('month', monthStr)
        .eq('status', 'pending'),
    ])

    if (attErr) {
      alert('Error loading attendance: ' + attErr.message)
      setCalculating(false)
      return
    }

    // Build set of govt holiday days (non-Sunday only)
    const govHolDays = new Set<number>(
      ((holData ?? []) as { date: string }[])
        .map((h) => parseInt(h.date.split('-')[2]))
        .filter((d) => new Date(year, month - 1, d).getDay() !== 0)
    )

    // Working days = all days except Sundays and Govt Holidays
    const workingDaysList = Array.from({ length: daysInMonth }, (_, i) => i + 1)
      .filter((d) => new Date(year, month - 1, d).getDay() !== 0 && !govHolDays.has(d))
    const workingDays = workingDaysList.length

    const attList = (attData ?? []) as { employee_id: string; date: string; status: string }[]

    // ── Validate: all working days must be marked for all employees ──────
    const missing: string[] = []
    for (const emp of empData as Employee[]) {
      const empAttDates = new Set(
        attList
          .filter((a) => a.employee_id === emp.id)
          .map((a) => parseInt(a.date.split('-')[2]))
      )
      const unmarkedDays = workingDaysList.filter((d) => !empAttDates.has(d))
      if (unmarkedDays.length > 0) {
        missing.push(`• ${emp.name}: ${unmarkedDays.length} day(s) not marked (${unmarkedDays.slice(0, 5).join(', ')}${unmarkedDays.length > 5 ? '...' : ''})`)
      }
    }

    if (missing.length > 0) {
      setAttWarnings(missing)
      setCalculating(false)
      return
    }

    setAttWarnings([]) // clear any previous warnings

    const advList = (advData ?? []) as SalaryAdvance[]

    const records = (empData as Employee[]).map((emp) => {
      const empAtt = attList.filter((a) => a.employee_id === emp.id)

      // Days explicitly marked as paid (present or half_day)
      const presentCount  = empAtt.filter((a) => a.status === 'present').length
      const halfDayCount  = empAtt.filter((a) => a.status === 'half_day').length
      const paidDays      = presentCount + halfDayCount

      // Unpaid = all remaining working days (absent + leave + unmarked = treated as absent)
      const unpaidDays    = workingDays - paidDays

      // Formula: (Salary / Days in Month) × (Days in Month − Unpaid Working Days)
      // Sundays + Govt Holidays are always paid (not in unpaidDays)
      const earnedSalary = parseFloat(
        ((emp.monthly_salary / daysInMonth) * (daysInMonth - unpaidDays)).toFixed(2)
      )

      // Sum pending advances for this employee this month
      const advanceAmount = parseFloat(
        advList
          .filter((a) => a.employee_id === emp.id)
          .reduce((s, a) => s + a.amount, 0)
          .toFixed(2)
      )

      // Net salary = earned − advances (cannot go below 0)
      const netSalary = parseFloat(Math.max(0, earnedSalary - advanceAmount).toFixed(2))

      return {
        employee_id:        emp.id,
        month:              monthStr,
        monthly_salary:     emp.monthly_salary,
        total_working_days: workingDays,
        present_days:       paidDays,
        half_days:          govHolDays.size,
        absent_days:        unpaidDays,
        earned_salary:      earnedSalary,
        advance_amount:     advanceAmount,
        net_salary:         netSalary,
        status:             'pending',
      }
    })

    const { error: upsertErr } = await supabase
      .from('salary_records')
      .upsert(records, { onConflict: 'employee_id,month' })

    // Mark advances as adjusted
    const advIds = advList.map((a) => a.id)
    if (advIds.length > 0) {
      await supabase.from('salary_advances').update({ status: 'adjusted' }).in('id', advIds)
    }

    if (upsertErr) {
      alert('Error saving salary records: ' + upsertErr.message)
      setCalculating(false)
      return
    }

    await loadData()
    setCalculating(false)
    alert(`Salary calculated for ${records.length} employees!`)
  }

  // ── Mark paid ─────────────────────────────────────────────────────────
  async function markPaid(row: SalaryRow) {
    setPayingId(row.id)
    const { error } = await supabase.from('salary_records').update({
      status:    'paid',
      paid_date: new Date().toISOString().split('T')[0],
    }).eq('id', row.id)
    if (error) alert('Error: ' + error.message)
    await loadData()
    setPayingId(null)
  }

  async function markAllPaid() {
    const pending = salaryRows.filter((r) => r.status === 'pending')
    if (pending.length === 0) return
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('salary_records')
      .update({ status: 'paid', paid_date: today })
      .in('id', pending.map((r) => r.id))
    await loadData()
  }

  // ── Export CSV ────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ['Employee', 'Designation', 'Days in Month', 'Working Days', 'Paid Days', 'Unpaid Days', 'Monthly Salary', 'Earned Salary', 'Advance', 'Net Payable', 'Status', 'Paid Date']
    const rows = salaryRows.map((r) => [
      r.employee.name,
      r.employee.designation ?? '',
      new Date(year, month, 0).getDate(),
      r.total_working_days,
      r.present_days,
      r.absent_days,
      r.monthly_salary,
      r.earned_salary,
      r.advance_amount || 0,
      netSalaryOf(r),
      r.status,
      r.paid_date ?? '',
    ])
    const csv  = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `salary-${monthStr}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const netSalaryOf  = (r: SalaryRow) => r.net_salary > 0 ? r.net_salary : r.earned_salary
  const totalPayroll = salaryRows.reduce((s, r) => s + r.earned_salary, 0)
  const totalAdvances = salaryRows.reduce((s, r) => s + (r.advance_amount || 0), 0)
  const totalNetPayroll = salaryRows.reduce((s, r) => s + netSalaryOf(r), 0)
  const totalPaid    = salaryRows.filter((r) => r.status === 'paid').reduce((s, r) => s + netSalaryOf(r), 0)
  const totalPending = salaryRows.filter((r) => r.status === 'pending').reduce((s, r) => s + netSalaryOf(r), 0)
  const pendingCount = salaryRows.filter((r) => r.status === 'pending').length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salary</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Formula: <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
              (Salary ÷ Days in Month) × (Days in Month − Unpaid Working Days)
            </span>
            <span className="text-xs text-slate-400 ml-2">· Unmarked working days = Absent</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {salaryRows.length > 0 && (
            <>
              <button onClick={exportCSV} className="btn-secondary">
                <Download size={16} /> Export CSV
              </button>
              {pendingCount > 0 && (
                <button onClick={markAllPaid} className="btn-secondary">
                  <CheckCircle size={16} /> Mark All Paid
                </button>
              )}
            </>
          )}
          <button onClick={calculateSalaries} disabled={calculating} className="btn-primary">
            <Calculator size={16} />
            {calculating ? 'Calculating...' : salaryRows.length > 0 ? 'Recalculate' : 'Calculate Salary'}
          </button>
        </div>
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
        <p className="text-sm text-slate-500">
          {daysInMonth} days in month
        </p>
      </div>

      {/* Summary Cards */}
      {salaryRows.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card p-5">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Gross Payroll</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">₹ {fmt(totalPayroll)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{salaryRows.length} employees</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-red-500 font-medium uppercase tracking-wide">Advances Adjusted</p>
            <p className="text-2xl font-bold text-red-600 mt-1">₹ {fmt(totalAdvances)}</p>
            <p className="text-xs text-slate-400 mt-0.5">deducted from payroll</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Paid</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">₹ {fmt(totalPaid)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{salaryRows.filter((r) => r.status === 'paid').length} employees</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">₹ {fmt(totalPending)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{pendingCount} employees</p>
          </div>
        </div>
      )}

      {/* Attendance incomplete warning */}
      {attWarnings.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <span className="text-red-600 font-bold text-sm">!</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-800 mb-1">
                Attendance not complete for {monthLabel}
              </p>
              <p className="text-sm text-red-600 mb-3">
                Please mark attendance for <strong>all working days</strong> for all employees before calculating salary. Go to the <strong>Attendance</strong> page and complete the entries.
              </p>
              <div className="space-y-1">
                {attWarnings.map((w, i) => (
                  <p key={i} className="text-sm text-red-700 font-mono bg-red-100 px-3 py-1 rounded">{w}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card p-16 text-center text-slate-400">Loading...</div>
      ) : employees.length === 0 ? (
        <div className="card p-16 text-center text-slate-400">No active employees found. Add employees first.</div>
      ) : salaryRows.length === 0 ? (
        <div className="card p-16 text-center">
          <Calculator size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600 font-medium">No salary records for {monthLabel}</p>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            Click <strong>Calculate Salary</strong> to auto-calculate from attendance data.
          </p>
          <button onClick={calculateSalaries} disabled={calculating} className="btn-primary mx-auto">
            <Calculator size={16} /> {calculating ? 'Calculating...' : 'Calculate Salary'}
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-center">Days in Month</th>
                <th className="px-4 py-3 text-center">Working Days</th>
                <th className="px-4 py-3 text-center">Paid Days</th>
                <th className="px-4 py-3 text-center">Unpaid Days</th>
                <th className="px-4 py-3 text-right">Monthly Salary</th>
                <th className="px-4 py-3 text-right">Earned Salary</th>
                <th className="px-4 py-3 text-right">Advance</th>
                <th className="px-4 py-3 text-right">Net Payable</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salaryRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{row.employee.name}</p>
                    {row.employee.designation && (
                      <p className="text-xs text-slate-400">{row.employee.designation}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-slate-700">{new Date(year, month, 0).getDate()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium"
                      title="Excludes Sundays and Govt Holidays">
                      {row.total_working_days}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium"
                      title="Present + Half Day">
                      {row.present_days}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold"
                      title="Absent + Leave + Unmarked working days">
                      {row.absent_days}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">₹ {fmt(row.monthly_salary)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹ {fmt(row.earned_salary)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.advance_amount > 0 ? (
                      <span className="text-red-600 font-medium">− ₹ {fmt(row.advance_amount)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">₹ {fmt(row.net_salary > 0 ? row.net_salary : row.earned_salary)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      row.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {row.status === 'paid' ? <CheckCircle size={11} /> : null}
                      {row.status === 'paid' ? `Paid ${row.paid_date ?? ''}` : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.status === 'pending' ? (
                      <button onClick={() => markPaid(row)} disabled={payingId === row.id}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        {payingId === row.id ? 'Saving...' : 'Mark Paid'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800 text-white">
                <td className="px-4 py-3 font-bold" colSpan={5}>Total — {monthLabel}</td>
                <td className="px-4 py-3 text-right font-medium">
                  ₹ {fmt(salaryRows.reduce((s, r) => s + r.monthly_salary, 0))}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-300">₹ {fmt(totalPayroll)}</td>
                <td className="px-4 py-3 text-right text-red-300 font-medium">
                  {salaryRows.some((r) => r.advance_amount > 0)
                    ? `− ₹ ${fmt(salaryRows.reduce((s, r) => s + (r.advance_amount || 0), 0))}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-300">
                  ₹ {fmt(salaryRows.reduce((s, r) => s + (r.net_salary > 0 ? r.net_salary : r.earned_salary), 0))}
                </td>
                <td colSpan={2} className="px-4 py-3 text-center text-xs text-slate-300">
                  {salaryRows.filter((r) => r.status === 'paid').length}/{salaryRows.length} paid
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
