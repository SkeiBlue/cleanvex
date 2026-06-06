-- AlterTable vehicles
ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "fuel_type"        TEXT,
  ADD COLUMN IF NOT EXISTS "color"            TEXT,
  ADD COLUMN IF NOT EXISTS "power"            INTEGER,
  ADD COLUMN IF NOT EXISTS "purchase_date"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "purchase_price"   DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "insurance_expiry" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "ct_expiry"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "notes"            TEXT;

-- AlterTable stock_items
ALTER TABLE "stock_items"
  ADD COLUMN IF NOT EXISTS "reference" TEXT,
  ADD COLUMN IF NOT EXISTS "supplier"  TEXT,
  ADD COLUMN IF NOT EXISTS "notes"     TEXT;
