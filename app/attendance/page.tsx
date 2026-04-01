'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, Attendance, AttendanceStatus } from '@/types'
import { ChevronLeft, ChevronRight, Save, CalendarPlus, Trash2, X } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_CYCLE: (AttendanceStatus | null)[] = [null, 'present', 'absent', 'half_day', 'leave']

const STATUS_CONFIG: Record<string, { label: string; short: string; bg: string; text: string }> = {
  present:  { label: 'Present',  short: 'P', bg: 'bg-emerald-500', text: 'text-white' },
  absent:   { label: 'Absent',   short: 'A', bg: 'bg-red-500',     text: 'text-white' },
  half_day: { label: 'Half Day', short: 'H', bg: 'bg-amber-400',   text: 'text-white' },
  leave:    { label: 'Leave',    short: 'L', bg: 'bg-blue-400',    text: 'text-white' },
}

const makeKey  = (empId: string, day: number) => `${empId}::${day}`
const parseKey = (key: string): [string, number] => {
  const idx = key.lastIndexOf('::')
  return [key.slice(0, idx), parseInt(key.slice(idx + 2))]
}

type AttendanceMap = Record<string, Record<number, AttendanceStatus>>
type Holiday = { id: string; date: string; name: string }

export default function AttendancePage() {
  const now = new Date()
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth() + 1)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attMap, setAttMap]     = useState<AttendanceMap>({})
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [dirty, setDirty]       = useState<Set<string>>(new Set())

  // Holiday modal
  const [showHolidayModal, setShowHolidayModal] = useState(false)
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '' })
  const [savingHoliday, setSavingHoliday] = useState(false)

  const daysInMonth = new Date(year, month, 0).getDate()
  const days        = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const monthLabel  = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const monthStr    = `${year}-${String(month).padStart(2, '0')}`

  const isSunday = (day: number) => new Date(year, month - 1, day).getDay() === 0

  // Build a set of holiday days for fast lookup
  const holidayDayMap: Record<number, string> = {}
  holidays.forEach((h) => {
    const d = parseInt(h.date.split('-')[2])
    holidayDayMap[d] = h.name
  })

  const isHoliday = (day: number) => day in holidayDayMap

  const loadData = useCallback(async () => {
    setLoading(true)
    const lastDay = String(daysInMonth).padStart(2, '0')

    const [{ data: emps }, { data: att }, { data: hols }] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active').order('name'),
      supabase.from('attendance')
        .select('*')
        .gte('date', `${monthStr}-01`)
        .lte('date', `${monthStr}-${lastDay}`),
      supabase.from('holidays')
        .select('*')
        .gte('date', `${monthStr}-01`)
        .lte('date', `${monthStr}-${lastDay}`)
        .order('date'),
    ])

    setEmployees((emps as Employee[]) ?? [])
    setHolidays((hols as Holiday[]) ?? [])

    const map: AttendanceMap = {}
    ;((att as Attendance[]) ?? []).forEach((a) => {
      const day = parseInt(a.date.split('-')[2])
      if (!map[a.employee_id]) map[a.employee_id] = {}
      map[a.employee_id][day] = a.status
    })
    setAttMap(map)
    setDirty(new Set())
    setLoading(false)
  }, [year, month, daysInMonth, monthStr])

  useEffect(() => { loadData() }, [loadData])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) } else setMonth((m) => m + 1)
  }

  function toggleCell(empId: string, day: number) {
    if (isSunday(day) || isHoliday(day)) return

    const current = attMap[empId]?.[day] ?? null
    const idx  = STATUS_CYCLE.indexOf(current)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]

    setAttMap((prev) => {
      const empMap = { ...(prev[empId] ?? {}) }
      if (next === null) delete empMap[day]
      else empMap[day] = next
      return { ...prev, [empId]: empMap }
    })
    setDirty((prev) => new Set(prev).add(makeKey(empId, day)))
  }

  // Mark all working days as Present for a single employee
  function markEmployeeAllPresent(empId: string) {
    const newDirty = new Set(dirty)
    const newMap   = { ...attMap, [empId]: { ...(attMap[empId] ?? {}) } }
    days.forEach((day) => {
      if (isSunday(day) || isHoliday(day)) return
      newMap[empId][day] = 'present'
      newDirty.add(makeKey(empId, day))
    })
    setAttMap(newMap)
    setDirty(newDirty)
  }

  function markDay(day: number, status: AttendanceStatus) {
    if (isSunday(day) || isHoliday(day)) return
    const newDirty = new Set(dirty)
    const newMap   = { ...attMap }
    employees.forEach((e) => {
      if (!newMap[e.id]) newMap[e.id] = {}
      newMap[e.id] = { ...newMap[e.id], [day]: status }
      newDirty.add(makeKey(e.id, day))
    })
    setAttMap(newMap)
    setDirty(newDirty)
  }

  async function handleSave() {
    if (dirty.size === 0) return
    setSaving(true)

    // Snapshot current attMap to avoid stale closure issues
    const currentMap = attMap
    const toUpsert: { employee_id: string; date: string; status: AttendanceStatus }[] = []
    const toDelete:  { employee_id: string; date: string }[] = []

    dirty.forEach((key) => {
      const [empId, day] = parseKey(key)
      const date   = `${monthStr}-${String(day).padStart(2, '0')}`
      const status = currentMap[empId]?.[day]
      if (status) toUpsert.push({ employee_id: empId, date, status })
      else        toDelete.push({ employee_id: empId, date })
    })

    // Delete first to avoid conflicts, then upsert
    for (const { employee_id, date } of toDelete) {
      await supabase.from('attendance').delete()
        .eq('employee_id', employee_id).eq('date', date)
    }

    if (toUpsert.length > 0) {
      // Delete existing records first to avoid duplicate key issues
      for (const rec of toUpsert) {
        await supabase.from('attendance').delete()
          .eq('employee_id', rec.employee_id).eq('date', rec.date)
      }
      // Then insert fresh
      const { error } = await supabase.from('attendance').insert(toUpsert)
      if (error) {
        alert('Save failed: ' + error.message)
        setSaving(false)
        return
      }
    }

    setDirty(new Set())
    setSaving(false)
    alert(`Attendance saved! (${toUpsert.length} marked, ${toDelete.length} cleared)`)
  }

  // Holiday management
  async function addHoliday() {
    if (!holidayForm.date || !holidayForm.name.trim()) return alert('Date and name are required.')
    setSavingHoliday(true)
    const { error } = await supabase.from('holidays').upsert(
      { date: holidayForm.date, name: holidayForm.name.trim() },
      { onConflict: 'date' }
    )
    if (error) { alert('Failed: ' + error.message); setSavingHoliday(false); return }
    setHolidayForm({ date: '', name: '' })
    setSavingHoliday(false)
    loadData()
  }

  async function deleteHoliday(id: string) {
    await supabase.from('holidays').delete().eq('id', id)
    loadData()
  }

  function getSummary(empId: string) {
    const map  = attMap[empId] ?? {}
    const vals = Object.values(map)
    return {
      P: vals.filter((v) => v === 'present').length,
      A: vals.filter((v) => v === 'absent').length,
      H: vals.filter((v) => v === 'half_day').length,
      L: vals.filter((v) => v === 'leave').length,
    }
  }

  // Non-editable day check
  const isBlocked = (day: number) => isSunday(day) || isHoliday(day)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Click cell to cycle: <strong>P</strong> → <strong>A</strong> → <strong>H</strong> → <strong>L</strong> → Clear &nbsp;|&nbsp;
            <span className="text-red-500 font-medium">Sunday</span> &amp;{' '}
            <span className="text-orange-500 font-medium">Govt Holidays</span> are auto-excluded
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHolidayModal(true)} className="btn-secondary">
            <CalendarPlus size={16} /> Manage Holidays
          </button>
          {dirty.size > 0 && (
            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              {dirty.size} unsaved
            </span>
          )}
          <button onClick={handleSave} disabled={saving || dirty.size === 0} className="btn-primary">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
          <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
            <ChevronLeft size={18} />
          </button>
          <span className="px-4 py-1 font-semibold text-slate-800 min-w-[160px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded text-center leading-5 font-bold text-[10px] ${v.bg} ${v.text}`}>{v.short}</span>
              <span className="text-slate-500">{v.label}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-red-200 text-red-600 text-[9px] font-bold flex items-center justify-center">Su</span>
            <span className="text-red-500">Sunday</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-orange-200 text-orange-600 text-[9px] font-bold flex items-center justify-center">GH</span>
            <span className="text-orange-500">Govt Holiday</span>
          </span>
        </div>
      </div>

      {/* Holidays this month */}
      {holidays.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {holidays.map((h) => (
            <span key={h.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 border border-orange-200 rounded-full text-xs text-orange-700 font-medium">
              <CalendarPlus size={11} />
              {h.date.split('-').reverse().join('/')} — {h.name}
            </span>
          ))}
        </div>
      )}

      {/* Bulk mark */}
      {!loading && employees.length > 0 && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500 mb-2 font-medium">Quick mark all employees for a working day:</p>
          <div className="flex flex-wrap gap-2">
            {days.filter((d) => !isBlocked(d)).map((day) => (
              <div key={day} className="flex items-center gap-0.5">
                <span className="text-xs font-medium text-slate-500 w-6 text-center">{day}</span>
                <button onClick={() => markDay(day, 'present')}
                  className="w-5 h-5 rounded bg-emerald-500 text-white text-[9px] font-bold hover:opacity-80">P</button>
                <button onClick={() => markDay(day, 'absent')}
                  className="w-5 h-5 rounded bg-red-500 text-white text-[9px] font-bold hover:opacity-80">A</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="card p-16 text-center text-slate-400">Loading attendance...</div>
      ) : employees.length === 0 ? (
        <div className="card p-16 text-center text-slate-400">No active employees. Add employees first.</div>
      ) : (
        <div className="card overflow-auto">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-slate-800">
                <th className="sticky left-0 z-10 bg-slate-800 text-white px-4 py-3 text-left font-semibold min-w-[180px]">
                  Employee
                </th>
                {days.map((day) => {
                  const dow    = new Date(year, month - 1, day).getDay()
                  const sun    = dow === 0
                  const sat    = dow === 6
                  const govHol = isHoliday(day)
                  return (
                    <th key={day}
                      className={`px-1 py-2 font-semibold text-center w-8 min-w-[32px] ${
                        sun    ? 'bg-red-800/40 text-red-300' :
                        govHol ? 'bg-orange-800/30 text-orange-300' :
                        sat    ? 'text-blue-300' : 'text-slate-300'
                      }`}
                      title={govHol ? holidayDayMap[day] : undefined}
                    >
                      <div>{day}</div>
                      <div className="text-[8px] opacity-70">
                        {['S','M','T','W','T','F','S'][dow]}
                      </div>
                    </th>
                  )
                })}
                <th className="px-2 py-3 text-center text-slate-300 font-semibold bg-slate-700 min-w-[100px]">Summary</th>
                <th className="px-2 py-3 text-center text-slate-300 font-semibold bg-slate-700 min-w-[90px]">All P</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, ri) => {
                const summary = getSummary(emp.id)
                const rowBg   = ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                return (
                  <tr key={emp.id} className={rowBg}>
                    <td className={`sticky left-0 z-10 ${rowBg} px-4 py-2 font-medium text-slate-900 border-r border-slate-200`}>
                      <div>{emp.name}</div>
                      {emp.designation && <div className="text-[10px] text-slate-400">{emp.designation}</div>}
                    </td>

                    {days.map((day) => {
                      const sun      = isSunday(day)
                      const govHol   = isHoliday(day)
                      const status   = attMap[emp.id]?.[day] ?? null
                      const cfg      = status ? STATUS_CONFIG[status] : null
                      const isDirty  = dirty.has(makeKey(emp.id, day))

                      if (sun) {
                        return (
                          <td key={day} className="p-0.5 text-center bg-red-50/50" title="Sunday Holiday">
                            <div className="w-7 h-7 rounded bg-red-100 text-red-400 text-[8px] font-bold flex items-center justify-center mx-auto cursor-not-allowed">
                              Su
                            </div>
                          </td>
                        )
                      }

                      if (govHol) {
                        return (
                          <td key={day} className="p-0.5 text-center bg-orange-50/60" title={holidayDayMap[day]}>
                            <div className="w-7 h-7 rounded bg-orange-100 text-orange-500 text-[8px] font-bold flex items-center justify-center mx-auto cursor-not-allowed">
                              GH
                            </div>
                          </td>
                        )
                      }

                      return (
                        <td key={day}
                          className={`p-0.5 text-center ${isDirty ? 'ring-1 ring-inset ring-amber-300' : ''}`}
                        >
                          <button
                            onClick={() => toggleCell(emp.id, day)}
                            className={`w-7 h-7 rounded font-bold transition-all hover:scale-110 ${
                              cfg ? `${cfg.bg} ${cfg.text}` : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                            }`}
                            title={cfg ? cfg.label : 'Click to mark'}
                          >
                            {cfg ? cfg.short : '·'}
                          </button>
                        </td>
                      )
                    })}

                    <td className="px-2 py-2 text-center border-l border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">{summary.P}P</span>
                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold">{summary.A}A</span>
                        {summary.H > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">{summary.H}H</span>}
                        {summary.L > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-semibold">{summary.L}L</span>}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center border-l border-slate-200 bg-slate-50">
                      <button
                        onClick={() => markEmployeeAllPresent(emp.id)}
                        className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded transition-colors whitespace-nowrap"
                        title={`Mark all working days Present for ${emp.name}`}
                      >
                        All P
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Manage Holidays Modal ─────────────────────────────────────── */}
      {showHolidayModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-lg">Manage Govt Holidays — {monthLabel}</h2>
              <button onClick={() => setShowHolidayModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Add Holiday Form */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Holiday</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">Date</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={holidayForm.date}
                    min={`${monthStr}-01`}
                    max={`${monthStr}-${String(daysInMonth).padStart(2, '0')}`}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  />
                </div>
                <div className="flex-[2]">
                  <label className="text-xs text-slate-500 mb-1 block">Holiday Name</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Pongal, Republic Day"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') addHoliday() }}
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={addHoliday} disabled={savingHoliday} className="btn-primary whitespace-nowrap">
                    {savingHoliday ? 'Adding...' : '+ Add'}
                  </button>
                </div>
              </div>
            </div>

            {/* Holiday List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {holidays.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  No holidays added for {monthLabel}
                </p>
              ) : (
                <div className="space-y-2">
                  {holidays.map((h) => {
                    const d   = new Date(h.date + 'T00:00:00')
                    const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]
                    return (
                      <div key={h.id}
                        className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{h.name}</p>
                          <p className="text-xs text-slate-500">
                            {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} &nbsp;·&nbsp; {dow}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteHoliday(h.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Remove holiday"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 text-right">
              <button onClick={() => setShowHolidayModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
