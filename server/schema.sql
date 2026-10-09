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
  recorded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  recorded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  buy_price NUMERIC(16, 2) NOT NULL CHECK (buy_price >= 0),
  total_cost NUMERIC(16, 2) NOT NULL CHECK (total_cost >= 0),
  supplier TEXT NOT NULL DEFAULT '',
  invoice_number TEXT NOT NULL DEFAULT '',
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
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

CREATE TABLE IF NOT EXISTS rentals (
  id BIGSERIAL PRIMARY KEY,
  equipment TEXT NOT NULL,
  client_or_owner TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  total_amount NUMERIC(16, 2) NOT NULL CHECK (total_amount >= 0),
  paid_amount NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'active',
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
CREATE INDEX IF NOT EXISTS field_expenses_created_idx ON field_expenses (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
