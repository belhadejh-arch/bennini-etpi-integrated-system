CREATE TABLE IF NOT EXISTS finance_accounts (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('customer', 'partner')),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  member_id TEXT UNIQUE REFERENCES members(clerk_user_id) ON DELETE RESTRICT,
  created_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (member_id IS NULL OR kind = 'partner')
);

CREATE TABLE IF NOT EXISTS customer_invoices (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  normalized_invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  created_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, normalized_invoice_number),
  UNIQUE (id, customer_id)
);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0 AND interest_rate <= 100);
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS customer_invoice_id BIGINT,
  ADD COLUMN IF NOT EXISTS total_sale NUMERIC(16,2) CHECK (total_sale IS NULL OR total_sale >= 0),
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'unit' CHECK (pricing_mode IN ('unit','total')),
  ADD COLUMN IF NOT EXISTS manual_paid BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cheques
  ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES finance_accounts(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_customer_invoice_owner_fk'
      AND conrelid = 'inventory_items'::regclass) THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_customer_invoice_owner_fk
      FOREIGN KEY (customer_invoice_id, customer_id) REFERENCES customer_invoices(id, customer_id) ON DELETE RESTRICT;
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_customer_invoice_requires_customer_check
      CHECK (customer_invoice_id IS NULL OR customer_id IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cheque_customer_invoices (
  cheque_id BIGINT NOT NULL REFERENCES cheques(id) ON DELETE CASCADE,
  invoice_id BIGINT NOT NULL REFERENCES customer_invoices(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (cheque_id, invoice_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_cheque_per_customer_invoice
  ON cheque_customer_invoices (invoice_id) WHERE active;
CREATE INDEX IF NOT EXISTS transactions_finance_account_idx ON transactions (account_id, transaction_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS inventory_customer_invoice_idx ON inventory_items (customer_invoice_id);
CREATE INDEX IF NOT EXISTS customer_invoices_customer_idx ON customer_invoices (customer_id, invoice_date DESC, id DESC);
