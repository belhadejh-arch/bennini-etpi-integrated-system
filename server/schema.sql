CREATE TABLE IF NOT EXISTS members (
  clerk_user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'pending',
  active BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_sections TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(16, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

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
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  beneficiary TEXT NOT NULL,
  bank TEXT NOT NULL DEFAULT '',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  created_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machinery (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'working',
  hours_worked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  performed_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  performed_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_party_idx ON transactions (party);
CREATE INDEX IF NOT EXISTS transaction_attachments_transaction_idx ON transaction_attachments (transaction_id, created_at);
CREATE INDEX IF NOT EXISTS inventory_items_name_idx ON inventory_items (name);
CREATE INDEX IF NOT EXISTS inventory_items_supplier_idx ON inventory_items (supplier);
CREATE INDEX IF NOT EXISTS inventory_items_invoice_idx ON inventory_items (invoice_number);
CREATE INDEX IF NOT EXISTS inventory_items_purchase_date_idx ON inventory_items (purchase_date DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_item_date_idx ON inventory_movements (inventory_item_id, movement_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS inventory_attachments_item_idx ON inventory_attachments (inventory_item_id, created_at);
CREATE INDEX IF NOT EXISTS cheques_number_idx ON cheques (cheque_number);
CREATE INDEX IF NOT EXISTS cheques_invoice_idx ON cheques (invoice_number);
CREATE INDEX IF NOT EXISTS cheques_beneficiary_idx ON cheques (beneficiary);
CREATE INDEX IF NOT EXISTS cheques_bank_idx ON cheques (bank);
CREATE INDEX IF NOT EXISTS cheques_status_due_idx ON cheques (status, due_date);
CREATE INDEX IF NOT EXISTS cheque_attachments_cheque_idx ON cheque_attachments (cheque_id, created_at);
CREATE INDEX IF NOT EXISTS rentals_end_date_idx ON rentals (end_date);
CREATE INDEX IF NOT EXISTS rental_attachments_rental_idx ON rental_attachments (rental_id, created_at);
CREATE INDEX IF NOT EXISTS field_expenses_created_idx ON field_expenses (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
