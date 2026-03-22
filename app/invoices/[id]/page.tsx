'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Invoice, InvoiceItem, Customer, Settings } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { Download, Printer, ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

// ─── Indian number to words ───────────────────────────────────────────────────
function numberToWords(n: number): string {
  if (n === 0) return 'Zero'
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tensArr = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convert(x: number): string {
    if (x < 20) return ones[x]
    if (x < 100) return tensArr[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '')
    return ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + convert(x % 100) : '')
  }

  let result = ''
  if (n >= 10000000) { result += convert(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000 }
  if (n >= 100000)   { result += convert(Math.floor(n / 100000))   + ' Lakh ';  n %= 100000 }
  if (n >= 1000)     { result += convert(Math.floor(n / 1000))     + ' Thousand '; n %= 1000 }
  if (n > 0)         { result += convert(n) }
  return result.trim()
}

// Primary colour — slate-blue (matches sample)
const PRIMARY = '#4b5f82'

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [invoice, setInvoice]   = useState<Invoice | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [items, setItems]       = useState<InvoiceItem[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: inv }, { data: itmData }, { data: settingsData }] = await Promise.all([
        supabase.from('invoices').select('*, customers(*)').eq('id', id).single(),
        supabase.from('invoice_items').select('*').eq('invoice_id', id),
        supabase.from('settings').select('*').single(),
      ])
      if (inv) {
        setInvoice(inv as Invoice)
        setCustomer((inv as any).customers as Customer)
      }
      setItems((itmData as InvoiceItem[]) ?? [])
      setSettings(settingsData as Settings)
      setLoading(false)
    }
    load()
  }, [id])

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  // ─── PDF Download ────────────────────────────────────────────────────────────
  async function downloadPDF() {
    if (!invoice || !customer || !settings) return
    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })

    const BLUE:  [number, number, number] = [75, 95, 130]   // #4b5f82
    const LGRAY: [number, number, number] = [248, 248, 248]
    const W  = 210
    const ML = 14
    const MR = 196
    const withGst = invoice.with_gst !== false
    const ROW_H = 8

    // ── 1. Logo + Company Name Band ──────────────────────────────────────────
    doc.setFillColor(...BLUE)
    doc.rect(0, 0, W, 20, 'F')

    // Logo
    if (settings.logo_data) {
      try {
        const logoFmt = settings.logo_data.includes('png') ? 'PNG' : 'JPEG'
        doc.addImage(settings.logo_data, logoFmt, ML, 2, 14, 14)
      } catch {
        // skip logo errors
      }
    } else {
      doc.setFillColor(255, 255, 255)
      doc.circle(ML + 7, 10, 6.5, 'F')
      doc.setTextColor(...BLUE)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      const initials = (settings.company_name || 'C')
        .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
      doc.text(initials, ML + 7, 12, { align: 'center' })
    }

    // Company name
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bolditalic')
    doc.text((settings.company_name || '').toUpperCase(), ML + 18, 13)

    // ── 2. Company Address (left) + Date / Invoice No (right) ───────────────
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    let y = 30

    const addrLines = (settings.address || '').split('\n').filter(Boolean)
    addrLines.forEach((line) => { doc.text(line, ML, y); y += 5 })
    if (settings.gstin) { doc.text(`GSTIN : ${settings.gstin}`, ML, y); y += 5 }

    // Right col
    doc.setFont('helvetica', 'bold')
    doc.text(`Date :`,       MR - 40, 30)
    doc.setFont('helvetica', 'normal')
    doc.text(invoice.issue_date, MR, 30, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.text(`Invoice No :`, MR - 40, 37)
    doc.setFont('helvetica', 'normal')
    doc.text(invoice.invoice_number, MR, 37, { align: 'right' })

    // ── 3. Separator ─────────────────────────────────────────────────────────
    const sepY = Math.max(y + 3, 55)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(ML, sepY, MR, sepY)

    // ── 4. "Invoice" centred heading ─────────────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text('Invoice', W / 2, sepY + 9, { align: 'center' })

    // ── 5. Bill To ───────────────────────────────────────────────────────────
    let cy = sepY + 18
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('BILL TO', ML, cy); cy += 6

    doc.text(customer.company || customer.name, ML, cy); cy += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    if (customer.company) { doc.text(customer.name, ML, cy); cy += 5 }
    if (customer.address) {
      customer.address.split('\n').filter(Boolean).forEach((l) => { doc.text(l, ML, cy); cy += 5 })
    }
    if (customer.gstin) {
      doc.setTextColor(100, 120, 160)
      doc.text(`GSTIN : ${customer.gstin}`, ML, cy); cy += 5
      doc.setTextColor(0, 0, 0)
    }

    // ── 6. Items Table ───────────────────────────────────────────────────────
    const tableStartY = Math.max(cy + 4, 120)
    const tableBody = items.map((item, idx) => [
      (idx + 1).toString(),
      item.description,
      item.hsn_code || '',
      item.quantity.toString(),
      item.unit || 'Nos',
      fmt(item.rate),
      fmt(item.amount),
    ])

    autoTable(doc, {
      startY: tableStartY,
      head: [['S.NO', 'DESCRIPTION', 'HSN Code', 'QTY', 'UNIT', 'RATE', 'AMOUNT (Rs)']],
      body: tableBody,
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LGRAY },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 13, halign: 'center' },
        4: { cellWidth: 13, halign: 'center' },
        5: { cellWidth: 27, halign: 'right' },
        6: { cellWidth: 27, halign: 'right' },
      },
      margin: { left: ML, right: 14 },
      styles: { fontSize: 9, lineColor: [180, 180, 180], lineWidth: 0.3 },
      tableLineColor: [150, 150, 150],
      tableLineWidth: 0.4,
    })

    const afterTableY = (doc as any).lastAutoTable.finalY

    // Separator line after table, before Account Details
    doc.setDrawColor(150, 150, 150)
    doc.setLineWidth(0.5)
    doc.line(ML, afterTableY + 3, MR, afterTableY + 3)

    const sectionY = afterTableY + 8

    // ── 7. Account Details (left) + Totals (right) ───────────────────────────
    const TX = 118
    let ay = sectionY
    let ty = sectionY

    // Account Details
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.text('ACCOUNT DETAILS', ML, ay); ay += 6

    if (settings.bank_name) {
      doc.text(`BANK NAME : ${settings.bank_name}`, ML, ay); ay += 5
    }
    doc.setFont('helvetica', 'normal')
    if (settings.branch)         { doc.text(`Branch : ${settings.branch}`,         ML, ay); ay += 5 }
    if (settings.account_name)   { doc.text(`A/C Name : ${settings.account_name}`, ML, ay); ay += 5 }
    if (settings.account_number) { doc.text(`A/C NO : ${settings.account_number}`, ML, ay); ay += 5 }
    if (settings.ifsc_code)      { doc.text(`IFSC : ${settings.ifsc_code}`,         ML, ay); ay += 5 }

    // Totals
    function drawTotalRow(label: string, amount: string, rowY: number, highlight: boolean) {
      if (highlight) {
        doc.setFillColor(...BLUE)
        doc.rect(TX, rowY, MR - TX, ROW_H, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
      } else {
        doc.setFillColor(...LGRAY)
        doc.rect(TX, rowY, MR - TX, ROW_H, 'F')
        doc.setDrawColor(210, 210, 210)
        doc.setLineWidth(0.2)
        doc.rect(TX, rowY, MR - TX, ROW_H, 'D')
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
      }
      doc.setFontSize(9)
      doc.text(label,            TX + 2, rowY + 5.5)
      doc.text(`Rs ${amount}`,   MR - 2, rowY + 5.5, { align: 'right' })
    }

    drawTotalRow('Subtotal', fmt(invoice.subtotal), ty, false); ty += ROW_H
    if (withGst) {
      drawTotalRow(`CGST@${invoice.cgst_rate ?? 9}%`, fmt(invoice.cgst_amount ?? 0), ty, false); ty += ROW_H
      drawTotalRow(`SGST@${invoice.sgst_rate ?? 9}%`, fmt(invoice.sgst_amount ?? 0), ty, false); ty += ROW_H
    }
    drawTotalRow('Total Bill Amount',      fmt(invoice.total),              ty, true); ty += ROW_H
    drawTotalRow('Total Amount (Roundoff)', fmt(Math.round(invoice.total)), ty, true); ty += ROW_H

    // ── 8. Amount in Words ───────────────────────────────────────────────────
    const wY = Math.max(ay + 4, sectionY + (ty - sectionY) + 4)
    doc.setFillColor(255, 248, 220)
    doc.setDrawColor(...BLUE)
    doc.setLineWidth(0.4)
    doc.rect(ML, wY, MR - ML, 10, 'FD')
    doc.setTextColor(...BLUE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    const rounded = Math.round(invoice.total)
    doc.text(
      `TOTAL AMOUNT : Rs ${fmt(rounded)} (${numberToWords(rounded).toUpperCase()} ONLY)`,
      ML + 3, wY + 6.5
    )

    // ── 9. Seal + Signature ──────────────────────────────────────────────────
    const sealY = wY + 14

    if (settings.seal_data) {
      try {
        const sealFmt = settings.seal_data.includes('png') ? 'PNG' : 'JPEG'
        doc.addImage(settings.seal_data, sealFmt, MR - 88, sealY, 36, 36)
      } catch {
        // skip
      }
    } else {
      doc.setDrawColor(...BLUE)
      doc.setLineWidth(0.4)
      doc.circle(MR - 70, sealY + 18, 16, 'D')
      doc.setTextColor(180, 180, 180)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Seal', MR - 70, sealY + 19, { align: 'center' })
    }

    if (settings.sign_data) {
      try {
        const signFmt = settings.sign_data.includes('png') ? 'PNG' : 'JPEG'
        doc.addImage(settings.sign_data, signFmt, MR - 46, sealY + 4, 38, 22)
      } catch {
        // skip
      }
    } else {
      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(0.3)
      doc.rect(MR - 46, sealY + 4, 38, 22, 'D')
      doc.setTextColor(180, 180, 180)
      doc.setFontSize(7)
      doc.text('Signature', MR - 27, sealY + 17, { align: 'center' })
    }

    doc.setDrawColor(100, 100, 100)
    doc.setLineWidth(0.2)
    doc.line(MR - 46, sealY + 30, MR - 8, sealY + 30)
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Authorised Signatory', MR - 27, sealY + 35, { align: 'center' })

    doc.save(`${invoice.invoice_number}.pdf`)
  }

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>
  if (!invoice || !customer) return <div className="p-8 text-slate-400">Invoice not found.</div>

  const withGst = invoice.with_gst !== false
  const rounded = Math.round(invoice.total)

  return (
    <div className="p-6 max-w-4xl">
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print { position: absolute; left: 0; top: 0; width: 100%; }
          #invoice-print table { width: 100%; border-collapse: collapse; }
          #invoice-print thead { display: table-header-group; }
          #invoice-print tbody { display: table-row-group; }
          #invoice-print tr  { display: table-row !important; page-break-inside: avoid; }
          #invoice-print td, #invoice-print th { display: table-cell !important; }
          #invoice-print * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 print-hidden">
        <button onClick={() => router.back()} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer size={16} /> Print
          </button>
          <button onClick={downloadPDF} className="btn-primary">
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* ── Invoice Card ──────────────────────────────────────────────────────── */}
      <div
        id="invoice-print"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
      >
        {/* 1. Header — Logo + Company Name */}
        <div style={{ backgroundColor: PRIMARY }} className="text-white px-6 py-3 flex items-center gap-4">
          {settings?.logo_data ? (
            <img
              src={settings.logo_data}
              alt="Logo"
              className="w-14 h-14 rounded-full object-cover border-2 border-white/40 bg-white"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl border-2 border-white/40">
              {(settings?.company_name || 'C').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <h2 className="text-xl font-bold italic tracking-wide">
            {settings?.company_name?.toUpperCase()}
          </h2>
        </div>

        {/* 2. Company Info + Date / Invoice No */}
        <div className="px-6 py-4 flex justify-between border-b border-slate-200">
          <div className="text-sm text-slate-700 space-y-0.5">
            {settings?.address?.split('\n').filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {settings?.gstin && <p>GSTIN : {settings.gstin}</p>}
            {settings?.phone && <p>Phone : {settings.phone}</p>}
          </div>
          <div className="text-right text-sm space-y-1">
            <p><span className="font-semibold">Date :</span> {invoice.issue_date}</p>
            <p><span className="font-semibold">Invoice No :</span> {invoice.invoice_number}</p>
            {(invoice as any).created_by && (
              <p className="text-slate-400 text-xs">
                Created by: <span className="font-medium text-slate-600">{(invoice as any).created_by}</span>
              </p>
            )}
            <div className="mt-2"><StatusBadge status={invoice.status} /></div>
          </div>
        </div>

        {/* 3. "Invoice" centred heading */}
        <div className="py-3 border-b border-slate-200 text-center">
          <h1 className="text-xl font-bold tracking-wide text-slate-800">Invoice</h1>
        </div>

        {/* 4. Bill To */}
        <div className="px-6 py-4 border-b border-slate-200">
          <p className="font-bold text-sm mb-2 text-slate-800">BILL TO</p>
          <p className="font-bold text-slate-900 text-base">{customer.company || customer.name}</p>
          {customer.company && <p className="text-slate-700 text-sm">{customer.name}</p>}
          {customer.address?.split('\n').filter(Boolean).map((line, i) => (
            <p key={i} className="text-slate-600 text-sm">{line}</p>
          ))}
          {customer.gstin && (
            <p className="text-sm font-mono mt-0.5" style={{ color: PRIMARY }}>
              GSTIN : {customer.gstin}
            </p>
          )}
        </div>

        {/* 5. Items Table */}
        <div className="px-6 py-4">
          <table className="w-full text-sm border-2 border-slate-400" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: PRIMARY }} className="text-white text-xs font-bold">
                <th className="px-2 py-2 text-center border border-slate-400 w-10">S.NO</th>
                <th className="px-3 py-2 text-left   border border-slate-400">DESCRIPTION</th>
                <th className="px-2 py-2 text-center border border-slate-400 w-24">HSN Code</th>
                <th className="px-2 py-2 text-center border border-slate-400 w-14">QTY</th>
                <th className="px-2 py-2 text-center border border-slate-400 w-16">UNIT</th>
                <th className="px-2 py-2 text-right  border border-slate-400 w-28">RATE</th>
                <th className="px-2 py-2 text-right  border border-slate-400 w-28">AMOUNT (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-2 py-2 text-center border border-slate-300 text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-2 border border-slate-300 text-slate-800">{item.description}</td>
                  <td className="px-2 py-2 text-center border border-slate-300 font-mono text-xs text-slate-600">
                    {item.hsn_code || ''}
                  </td>
                  <td className="px-2 py-2 text-center border border-slate-300">{item.quantity}</td>
                  <td className="px-2 py-2 text-center border border-slate-300">{item.unit || 'Nos'}</td>
                  <td className="px-2 py-2 text-right  border border-slate-300">&#8377; {fmt(item.rate)}</td>
                  <td className="px-2 py-2 text-right  border border-slate-300 font-semibold">
                    &#8377; {fmt(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Separator line before Account Details */}
        <div className="mx-6 my-1 border-t-2 border-slate-300" />

        {/* 6. Account Details (left) + Totals (right) */}
        <div className="px-6 py-4 flex gap-6 border-b border-slate-200">
          {/* Account Details */}
          <div className="flex-1 text-sm space-y-1">
            <p className="font-bold text-slate-800">ACCOUNT DETAILS</p>
            {settings?.bank_name && (
              <p className="font-bold text-slate-800">BANK NAME : {settings.bank_name}</p>
            )}
            {settings?.branch         && <p>Branch : {settings.branch}</p>}
            {settings?.account_name   && <p>A/C Name : {settings.account_name}</p>}
            {settings?.account_number && <p>A/C NO : {settings.account_number}</p>}
            {settings?.ifsc_code      && <p>IFSC : {settings.ifsc_code}</p>}
          </div>

          {/* Totals */}
          <div className="w-80 text-sm border border-slate-200 self-start">
            <div className="flex justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold">&#8377; {fmt(invoice.subtotal)}</span>
            </div>
            {withGst && (
              <>
                <div className="flex justify-between px-3 py-2 border-b border-slate-200">
                  <span className="text-slate-600">CGST@{invoice.cgst_rate ?? 9}%</span>
                  <span>&#8377; {fmt(invoice.cgst_amount ?? 0)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 border-b border-slate-200">
                  <span className="text-slate-600">SGST@{invoice.sgst_rate ?? 9}%</span>
                  <span>&#8377; {fmt(invoice.sgst_amount ?? 0)}</span>
                </div>
              </>
            )}
            <div
              className="flex justify-between px-3 py-2 text-white border-b"
              style={{ backgroundColor: PRIMARY }}
            >
              <span className="font-bold">Total Bill Amount</span>
              <span className="font-bold">&#8377; {fmt(invoice.total)}</span>
            </div>
            <div
              className="flex justify-between px-3 py-2 text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              <span className="font-bold">Total Amount (Roundoff)</span>
              <span className="font-bold">&#8377; {fmt(rounded)}</span>
            </div>
          </div>
        </div>

        {/* 7. Amount in Words */}
        <div className="mx-6 my-3 bg-amber-50 rounded px-4 py-2.5" style={{ border: `1px solid ${PRIMARY}` }}>
          <p className="font-bold text-sm" style={{ color: PRIMARY }}>
            TOTAL AMOUNT : Rs {fmt(rounded)} ({numberToWords(rounded).toUpperCase()} ONLY)
          </p>
        </div>

        {/* 8. Seal & Signature */}
        <div className="px-6 pb-8 flex justify-end gap-8 items-end">
          {/* Seal */}
          {settings?.seal_data ? (
            <div className="text-center">
              <img src={settings.seal_data} alt="Seal" className="w-28 h-28 object-contain mx-auto" />
              <p className="text-xs text-slate-400 mt-1">Seal</p>
            </div>
          ) : (
            <div className="text-center">
              <div
                className="w-28 h-28 rounded-full border-2 border-dashed flex items-center justify-center text-xs mx-auto"
                style={{ borderColor: PRIMARY, color: PRIMARY }}
              >
                Seal
              </div>
              <p className="text-xs text-slate-400 mt-1">Seal</p>
            </div>
          )}

          {/* Signature */}
          {settings?.sign_data ? (
            <div className="text-center">
              <img src={settings.sign_data} alt="Signature" className="w-36 h-20 object-contain mx-auto" />
              <div className="border-t border-slate-300 mt-2 pt-1">
                <p className="text-xs text-slate-500 font-medium">Authorised Signatory</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-36 h-20 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                Signature
              </div>
              <div className="border-t border-slate-300 mt-2 pt-1">
                <p className="text-xs text-slate-500 font-medium">Authorised Signatory</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
