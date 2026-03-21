'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Settings } from '@/types'
import { Save, Upload, X } from 'lucide-react'

type FormState = Omit<Settings, 'id' | 'default_tax_rate' | 'invoice_prefix'>

const defaultForm: FormState = {
  company_name: '',
  gstin: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  invoice_prefix_gst: 'GST',
  invoice_prefix_non_gst: 'INV',
  default_cgst: 9,
  default_sgst: 9,
  account_name: '',
  bank_name: '',
  branch: '',
  account_number: '',
  ifsc_code: '',
  logo_data: null,
  seal_data: null,
  sign_data: null,
}

function ImageUpload({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string | null
  onChange: (data: string | null) => void
  hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onChange(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      <div className="flex items-start gap-4">
        {value ? (
          <div className="relative">
            <img
              src={value}
              alt={label}
              className="w-24 h-24 object-contain border border-slate-200 rounded-lg bg-slate-50"
            />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => ref.current?.click()}
            className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <Upload size={20} className="text-slate-400 mb-1" />
            <span className="text-xs text-slate-400">Upload</span>
          </div>
        )}
        <div className="flex flex-col gap-2 mt-2">
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <Upload size={13} /> {value ? 'Change' : 'Upload Image'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <X size={13} /> Remove
            </button>
          )}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('settings').select('*').single()
      if (data) {
        setSettingsId(data.id)
        setForm({
          company_name: data.company_name ?? '',
          gstin: data.gstin ?? '',
          address: data.address ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          website: data.website ?? '',
          invoice_prefix_gst: data.invoice_prefix_gst ?? 'GST',
          invoice_prefix_non_gst: data.invoice_prefix_non_gst ?? 'INV',
          default_cgst: data.default_cgst ?? 9,
          default_sgst: data.default_sgst ?? 9,
          account_name: data.account_name ?? '',
          bank_name: data.bank_name ?? '',
          branch: data.branch ?? '',
          account_number: data.account_number ?? '',
          ifsc_code: data.ifsc_code ?? '',
          logo_data: data.logo_data ?? null,
          seal_data: data.seal_data ?? null,
          sign_data: data.sign_data ?? null,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    if (settingsId) {
      await supabase.from('settings').update(form).eq('id', settingsId)
    } else {
      const { data } = await supabase.from('settings').insert(form).select().single()
      if (data) setSettingsId(data.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function set(field: keyof FormState, value: string | number | null) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* Company Info */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-3">Company Information</h2>
        <div>
          <label className="label">Company Name</label>
          <input className="input" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
        </div>
        <div>
          <label className="label">GSTIN</label>
          <input
            className="input font-mono"
            placeholder="22AAAAA0000A1Z5"
            value={form.gstin}
            onChange={(e) => set('gstin', e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <label className="label">Address</label>
          <textarea
            className="input"
            rows={3}
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="info@company.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Website</label>
          <input
            className="input"
            placeholder="www.company.com"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
          />
        </div>
      </div>

      {/* Logo, Seal & Signature */}
      <div className="card p-6 space-y-6">
        <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-3">Logo, Seal &amp; Signature</h2>
        <ImageUpload
          label="Company Logo"
          value={form.logo_data}
          onChange={(v) => set('logo_data', v)}
          hint="Appears in the invoice header next to company name. Recommended: square PNG/JPG."
        />
        <div className="border-t border-slate-100 pt-4">
          <ImageUpload
            label="Company Seal"
            value={form.seal_data}
            onChange={(v) => set('seal_data', v)}
            hint="Official round stamp / seal. PNG with transparent background works best."
          />
        </div>
        <div className="border-t border-slate-100 pt-4">
          <ImageUpload
            label="Signature"
            value={form.sign_data}
            onChange={(v) => set('sign_data', v)}
            hint="Authorised signatory signature. PNG with transparent background works best."
          />
        </div>
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
          💡 Both Seal and Signature appear side by side at the bottom right of every invoice and PDF.
        </p>
      </div>

      {/* Invoice Prefixes */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-3">Invoice Numbering</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Invoice Prefix (GST)</label>
            <input
              className="input"
              placeholder="GST"
              value={form.invoice_prefix_gst}
              onChange={(e) => set('invoice_prefix_gst', e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">e.g. GST-0001</p>
          </div>
          <div>
            <label className="label">Invoice Prefix (Without GST)</label>
            <input
              className="input"
              placeholder="INV"
              value={form.invoice_prefix_non_gst}
              onChange={(e) => set('invoice_prefix_non_gst', e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">e.g. INV-0001</p>
          </div>
        </div>
      </div>

      {/* Tax Rates */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-3">Default Tax Rates</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Default CGST %</label>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.default_cgst}
              onChange={(e) => set('default_cgst', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="label">Default SGST %</label>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.default_sgst}
              onChange={(e) => set('default_sgst', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">Total GST = CGST + SGST (e.g. 9% + 9% = 18%)</p>
      </div>

      {/* Bank / Account Details */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-3">Account Details</h2>
        <p className="text-xs text-slate-400">These appear in the Account Details section of every invoice.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Account Name</label>
            <input className="input" value={form.account_name} onChange={(e) => set('account_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Bank Name</label>
            <input className="input" value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Branch</label>
            <input className="input" value={form.branch} onChange={(e) => set('branch', e.target.value)} />
          </div>
          <div>
            <label className="label">Account Number</label>
            <input
              className="input font-mono"
              value={form.account_number}
              onChange={(e) => set('account_number', e.target.value)}
            />
          </div>
          <div>
            <label className="label">IFSC Code</label>
            <input
              className="input font-mono"
              placeholder="SBIN0001234"
              value={form.ifsc_code}
              onChange={(e) => set('ifsc_code', e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        {saved && <p className="text-sm text-green-600 font-medium">✓ Settings saved!</p>}
        <div className="ml-auto">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
