CREATE TABLE IF NOT EXISTS members (
  clerk_user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  serial_lookup TEXT UNIQUE,
  serial_hash TEXT,
  serial_encrypted TEXT,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'pending',
  active BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  allowed_sections TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE members ALTER COLUMN email DROP NOT NULL;
ALTER TABLE members ADD COLUMN IF NOT EXISTS serial_lookup TEXT UNIQUE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS serial_hash TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS serial_encrypted TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS role_name TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE members ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL
  DEFAULT '{"uploadFiles":true,"viewFinancialData":true,"manageOperations":true}'::jsonb;

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  normalized_invoice_number TEXT NOT NULL,
  invoice_date DATE,
  recorded_by_id TEXT REFERENCES members(clerk_user_id) ON DELETE SET NULL,
  recorded_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, normalized_invoice_number),
  UNIQUE (id, supplier_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  party TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'نقداً',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cash_balance_after NUMERIC(16, 2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  recorded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  recorded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_attachments (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  file_data BYTEA NOT NULL,
  uploaded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  buy_price NUMERIC(16, 2) NOT NULL CHECK (buy_price >= 0),
  total_cost NUMERIC(16, 2) NOT NULL CHECK (total_cost >= 0),
  sale_price NUMERIC(16, 2) CHECK (sale_price IS NULL OR sale_price >= 0),
  supplier TEXT NOT NULL DEFAULT '',
  invoice_number TEXT NOT NULL DEFAULT '',
  supplier_id BIGINT REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_id BIGINT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  recorded_by_id TEXT REFERENCES members(clerk_user_id) ON DELETE SET NULL,
  recorded_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(16, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES suppliers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS invoice_id BIGINT,
  ADD COLUMN IF NOT EXISTS recorded_by_id TEXT REFERENCES members(clerk_user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorded_by_name TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_items_invoice_supplier_fkey'
      AND conrelid = 'inventory_items'::regclass
  ) THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_invoice_supplier_fkey
      FOREIGN KEY (invoice_id, supplier_id) REFERENCES purchase_invoices(id, supplier_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_items_invoice_requires_supplier_check'
      AND conrelid = 'inventory_items'::regclass
  ) THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_invoice_requires_supplier_check
      CHECK (invoice_id IS NULL OR supplier_id IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'use')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(16, 2) CHECK (unit_price IS NULL OR unit_price >= 0),
  counterparty TEXT NOT NULL DEFAULT '',
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  recorded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  recorded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (movement_type = 'sale' AND unit_price IS NOT NULL) OR
    (movement_type = 'use' AND unit_price IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS inventory_attachments (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  file_data BYTEA NOT NULL,
  uploaded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cheques (
  id BIGSERIAL PRIMARY KEY,
  cheque_number TEXT NOT NULL,
  invoice_number TEXT NOT NULL DEFAULT '',
  invoice_id BIGINT REFERENCES purchase_invoices(id) ON DELETE SET NULL,
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  beneficiary TEXT NOT NULL,
  bank TEXT NOT NULL DEFAULT '',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  recorded_by_id TEXT REFERENCES members(clerk_user_id) ON DELETE SET NULL,
  recorded_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cheques
  ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES purchase_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorded_by_id TEXT REFERENCES members(clerk_user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorded_by_name TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS cheque_attachments (
  id BIGSERIAL PRIMARY KEY,
  cheque_id BIGINT NOT NULL REFERENCES cheques(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  file_data BYTEA NOT NULL,
  uploaded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rentals (
  id BIGSERIAL PRIMARY KEY,
  equipment TEXT NOT NULL,
  client_or_owner TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  total_amount NUMERIC(16, 2) NOT NULL CHECK (total_amount >= 0),
  paid_amount NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  rate_period TEXT NOT NULL DEFAULT 'daily' CHECK (rate_period IN ('daily', 'monthly')),
  rental_rate NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (rental_rate >= 0),
  duration INTEGER NOT NULL DEFAULT 1 CHECK (duration > 0),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_attachments (
  id BIGSERIAL PRIMARY KEY,
  rental_id BIGINT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_data BYTEA NOT NULL,
  uploaded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_expenses (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  site_name TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  fuel_liters NUMERIC(10, 2),
  notes TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed')),
  reviewed_by_id TEXT REFERENCES members(clerk_user_id),
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT NOT NULL DEFAULT '',
  created_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_expense_attachments (
  id BIGSERIAL PRIMARY KEY,
  field_expense_id BIGINT NOT NULL REFERENCES field_expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_data BYTEA NOT NULL,
  uploaded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machinery (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'working',
  hours_worked INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE machinery ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS machinery_spare_parts (
  id BIGSERIAL PRIMARY KEY,
  machinery_id BIGINT NOT NULL REFERENCES machinery(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  buy_price NUMERIC(16, 2) NOT NULL CHECK (buy_price >= 0),
  supplier TEXT NOT NULL DEFAULT '',
  invoice_number TEXT NOT NULL DEFAULT '',
  supplier_id BIGINT REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_id BIGINT,
  installation_date DATE,
  stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0 AND stock_quantity <= quantity),
  repair_expense NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (repair_expense >= 0),
  notes TEXT NOT NULL DEFAULT '',
  recorded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  recorded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE machinery_spare_parts
  ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES suppliers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS invoice_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'machinery_spare_parts_invoice_supplier_fkey'
      AND conrelid = 'machinery_spare_parts'::regclass
  ) THEN
    ALTER TABLE machinery_spare_parts ADD CONSTRAINT machinery_spare_parts_invoice_supplier_fkey
      FOREIGN KEY (invoice_id, supplier_id) REFERENCES purchase_invoices(id, supplier_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'machinery_spare_parts_invoice_requires_supplier_check'
      AND conrelid = 'machinery_spare_parts'::regclass
  ) THEN
    ALTER TABLE machinery_spare_parts ADD CONSTRAINT machinery_spare_parts_invoice_requires_supplier_check
      CHECK (invoice_id IS NULL OR supplier_id IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS machinery_spare_part_attachments (
  id BIGSERIAL PRIMARY KEY,
  spare_part_id BIGINT NOT NULL REFERENCES machinery_spare_parts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  file_data BYTEA NOT NULL,
  uploaded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  performed_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  performed_by_name TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'system',
  event_type TEXT NOT NULL DEFAULT 'other',
  entity_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS audit_log_notes (
  audit_log_id BIGINT PRIMARY KEY REFERENCES audit_logs(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  updated_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  updated_by_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_party_idx ON transactions (party);
CREATE INDEX IF NOT EXISTS transaction_attachments_transaction_idx ON transaction_attachments (transaction_id, created_at);
CREATE INDEX IF NOT EXISTS inventory_items_name_idx ON inventory_items (name);
CREATE INDEX IF NOT EXISTS inventory_items_supplier_idx ON inventory_items (supplier);
CREATE INDEX IF NOT EXISTS inventory_items_invoice_idx ON inventory_items (invoice_number);
CREATE INDEX IF NOT EXISTS inventory_items_supplier_id_idx ON inventory_items (supplier_id);
CREATE INDEX IF NOT EXISTS inventory_items_invoice_id_idx ON inventory_items (invoice_id);
CREATE INDEX IF NOT EXISTS purchase_invoices_date_idx ON purchase_invoices (invoice_date DESC);
CREATE INDEX IF NOT EXISTS inventory_items_purchase_date_idx ON inventory_items (purchase_date DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_item_date_idx ON inventory_movements (inventory_item_id, movement_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS inventory_attachments_item_idx ON inventory_attachments (inventory_item_id, created_at);
CREATE INDEX IF NOT EXISTS cheques_number_idx ON cheques (cheque_number);
CREATE INDEX IF NOT EXISTS cheques_invoice_idx ON cheques (invoice_number);
CREATE INDEX IF NOT EXISTS cheques_invoice_id_idx ON cheques (invoice_id);
CREATE INDEX IF NOT EXISTS cheques_beneficiary_idx ON cheques (beneficiary);
CREATE INDEX IF NOT EXISTS cheques_bank_idx ON cheques (bank);
CREATE INDEX IF NOT EXISTS cheques_status_due_idx ON cheques (status, due_date);
CREATE INDEX IF NOT EXISTS cheque_attachments_cheque_idx ON cheque_attachments (cheque_id, created_at);
CREATE INDEX IF NOT EXISTS rentals_end_date_idx ON rentals (end_date);
CREATE INDEX IF NOT EXISTS rental_attachments_rental_idx ON rental_attachments (rental_id, created_at);
CREATE INDEX IF NOT EXISTS machinery_spare_parts_machine_date_idx ON machinery_spare_parts (machinery_id, installation_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS machinery_spare_parts_supplier_id_idx ON machinery_spare_parts (supplier_id);
CREATE INDEX IF NOT EXISTS machinery_spare_parts_invoice_id_idx ON machinery_spare_parts (invoice_id);
CREATE INDEX IF NOT EXISTS machinery_spare_part_attachments_part_idx ON machinery_spare_part_attachments (spare_part_id, created_at);
CREATE INDEX IF NOT EXISTS field_expenses_created_idx ON field_expenses (created_at DESC);
CREATE INDEX IF NOT EXISTS field_expenses_review_created_idx ON field_expenses (review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS field_expense_attachments_expense_idx ON field_expense_attachments (field_expense_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_performed_by_created_idx ON audit_logs (performed_by_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_logs_section_created_idx ON audit_logs (section, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_type_created_idx ON audit_logs (event_type, created_at DESC);
