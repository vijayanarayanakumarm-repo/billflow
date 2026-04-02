export type DescriptionMaster = {
  id: string
  description: string
  hsn_code: string | null
  unit: string
  rate: number
  created_at: string
}

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

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave'

export type Employee = {
  id: string
  employee_code: string | null
  name: string
  designation: string | null
  department: string | null
  phone: string | null
  email: string | null
  address: string | null
  date_of_birth: string | null
  date_of_joining: string | null
  monthly_salary: number
  bank_name: string | null
  account_number: string | null
  ifsc_code: string | null
  pan_number: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export type Attendance = {
  id: string
  employee_id: string
  date: string
  status: AttendanceStatus
  created_at: string
}

export type SalaryRecord = {
  id: string
  employee_id: string
  month: string
  monthly_salary: number
  total_working_days: number
  present_days: number
  half_days: number
  absent_days: number
  earned_salary: number
  advance_amount: number
  net_salary: number
  status: 'pending' | 'paid'
  paid_date: string | null
  notes: string | null
  created_at: string
  employees?: Employee
}

export type SalaryAdvance = {
  id: string
  employee_id: string
  amount: number
  month: string
  reason: string | null
  status: 'pending' | 'adjusted'
  created_at: string
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
  invoice_start_gst: number
  invoice_start_non_gst: number
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
