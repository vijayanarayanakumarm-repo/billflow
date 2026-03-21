-- BillFlow Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 18,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) GENERATED ALWAYS AS (quantity * rate) STORED
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer','upi','cash','cheque','card','other')),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table (single row per user)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT DEFAULT 'My Company',
  gstin TEXT DEFAULT '',
  default_tax_rate NUMERIC(5,2) DEFAULT 18,
  address TEXT DEFAULT '',
  invoice_prefix TEXT DEFAULT 'INV',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO settings (company_name, gstin, default_tax_rate, address, invoice_prefix)
VALUES ('My Company', '', 18, '', 'INV')
ON CONFLICT DO NOTHING;

-- Trigger function: recalculate invoice totals when items change
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_subtotal NUMERIC(12,2);
  v_tax_rate NUMERIC(5,2);
  v_tax_amount NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  -- Determine which invoice to update
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  -- Sum all items for this invoice
  SELECT COALESCE(SUM(quantity * rate), 0)
  INTO v_subtotal
  FROM invoice_items
  WHERE invoice_id = v_invoice_id;

  -- Get current tax rate
  SELECT tax_rate INTO v_tax_rate FROM invoices WHERE id = v_invoice_id;

  v_tax_amount := ROUND(v_subtotal * v_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax_amount;

  -- Update invoice
  UPDATE invoices
  SET subtotal = v_subtotal,
      tax_amount = v_tax_amount,
      total = v_total
  WHERE id = v_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: after insert/update/delete on invoice_items
DROP TRIGGER IF EXISTS trg_recalculate_invoice_totals ON invoice_items;
CREATE TRIGGER trg_recalculate_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_totals();

-- Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: allow all for authenticated users
-- Customers
CREATE POLICY "authenticated_all_customers" ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Invoices
CREATE POLICY "authenticated_all_invoices" ON invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Invoice items
CREATE POLICY "authenticated_all_invoice_items" ON invoice_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Payments
CREATE POLICY "authenticated_all_payments" ON payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Settings
CREATE POLICY "authenticated_all_settings" ON settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow anon access (for demo/dev; tighten in production)
CREATE POLICY "anon_all_customers" ON customers
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_invoices" ON invoices
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_invoice_items" ON invoice_items
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_payments" ON payments
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_settings" ON settings
  FOR ALL TO anon USING (true) WITH CHECK (true);
