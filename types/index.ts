export type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  address: string | null
  gstin: string | null
  created_at: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export type Invoice = {
  id: string
  invoice_number: string
  customer_id: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  notes: string | null
  created_at: string
  with_gst: boolean
  cgst_rate: number
  sgst_rate: number
  cgst_amount: number
  sgst_amount: number
  customers?: Customer
}

export type InvoiceItem = {
  id: string
  invoice_id: string
  description: string
  hsn_code: string | null
  quantity: number
  unit: string
  rate: number
  amount: number
}

export type PaymentMethod = 'bank_transfer' | 'upi' | 'cash' | 'cheque' | 'card' | 'other'

export type Payment = {
  id: string
  invoice_id: string
  customer_id: string
  amount: number
  payment_date: string
  method: PaymentMethod
  reference: string | null
  notes: string | null
  created_at: string
  invoices?: Invoice
  customers?: Customer
}

export type Settings = {
  id: string
  company_name: string
  gstin: string
  default_tax_rate: number
  address: string
  phone: string
  email: string
  website: string
  invoice_prefix: string
  invoice_prefix_gst: string
  invoice_prefix_non_gst: string
  default_cgst: number
  default_sgst: number
  account_name: string
  bank_name: string
  branch: string
  account_number: string
  ifsc_code: string
  logo_data: string | null
  seal_data: string | null
  sign_data: string | null
}
