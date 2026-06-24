-- stock_entries table (mirrors entry model from renderer.js getBalances + main.js createStore)
CREATE TABLE IF NOT EXISTS stock_entries (
  id UUID PRIMARY KEY,
  date DATE NOT NULL,
  type VARCHAR(3) NOT NULL CHECK (type IN ('in', 'out')),
  item VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL DEFAULT '',
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_stock_entries_item ON stock_entries(item);
CREATE INDEX IF NOT EXISTS idx_stock_entries_category ON stock_entries(category);
CREATE INDEX IF NOT EXISTS idx_stock_entries_date ON stock_entries(date);
CREATE INDEX IF NOT EXISTS idx_stock_entries_type ON stock_entries(type);

-- app_settings table (key-value store per DB-03)
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- stock_balance view (computed from stock_entries per DB-04, mirrors renderer.js getBalances() lines 22-51)
CREATE OR REPLACE VIEW stock_balance AS
SELECT
  item,
  category,
  SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) AS in_qty,
  SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) AS out_qty,
  SUM(CASE WHEN type = 'in' THEN quantity ELSE -quantity END) AS balance,
  MAX(CASE WHEN type = 'in' THEN rate ELSE 0 END) FILTER (WHERE type = 'in') AS latest_rate,
  SUM(CASE WHEN type = 'in' THEN quantity ELSE -quantity END) *
    MAX(CASE WHEN type = 'in' THEN rate ELSE 0 END) FILTER (WHERE type = 'in') AS value
FROM stock_entries
GROUP BY item, category;
