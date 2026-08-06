-- 1. Create distributors table
CREATE TABLE IF NOT EXISTS aap_distributors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  commission_pct NUMERIC NOT NULL DEFAULT 15,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add distributor columns to orders table
ALTER TABLE aap_orders
  ADD COLUMN IF NOT EXISTS distributor_id TEXT,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_area TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

-- 3. Enable RLS for distributors (matching your existing pattern)
ALTER TABLE aap_distributors ENABLE ROW LEVEL SECURITY;

-- 4. RLS policy: allow all for service role (same pattern as other tables)
CREATE POLICY "Allow all for service role" ON aap_distributors
  FOR ALL USING (true) WITH CHECK (true);