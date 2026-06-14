-- Sprint 5 — budgets, document categories slug, immobilier complet

-- DocumentCategory: ajout slug + isSystem
ALTER TABLE "document_categories" ADD COLUMN "slug" TEXT;
ALTER TABLE "document_categories" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;

-- Seed des catégories système (slug stable utilisé par auto-assignation)
INSERT INTO "document_categories" ("id", "name", "slug", "module_key", "is_system")
VALUES
  (gen_random_uuid(), 'Général',     'general',     NULL,           true),
  (gen_random_uuid(), 'Véhicules',   'vehicles',    'vehicles',     true),
  (gen_random_uuid(), 'Immobilier',  'real-estate', 'real-estate',  true),
  (gen_random_uuid(), 'Finances',    'finances',    'finances',     true),
  (gen_random_uuid(), 'Stock',       'stock',       'stock',        true),
  (gen_random_uuid(), 'Contacts',    'contacts',    'contacts',     true)
ON CONFLICT DO NOTHING;

-- Compléter le slug des catégories pré-existantes (au cas où)
UPDATE "document_categories" SET "slug" = 'general' WHERE "slug" IS NULL;

ALTER TABLE "document_categories" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "document_categories_slug_key" ON "document_categories"("slug");

-- Document: ajout category_id
ALTER TABLE "documents" ADD COLUMN "category_id" TEXT;
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "document_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "documents_category_id_idx" ON "documents"("category_id");

-- PropertyZone
CREATE TABLE "property_zones" (
  "id"          TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "notes"       TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "property_zones_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "property_zones"
  ADD CONSTRAINT "property_zones_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "property_zones_property_id_idx" ON "property_zones"("property_id");

-- PropertyWork
CREATE TABLE "property_works" (
  "id"                  TEXT NOT NULL,
  "property_id"         TEXT NOT NULL,
  "zone_id"             TEXT,
  "title"               TEXT NOT NULL,
  "description"         TEXT,
  "status"              TEXT NOT NULL DEFAULT 'planned',
  "priority"            TEXT NOT NULL DEFAULT 'normal',
  "budget_amount"       DECIMAL(12,2),
  "actual_amount"       DECIMAL(12,2),
  "start_date"          TIMESTAMP(3),
  "end_date"            TIMESTAMP(3),
  "supplier_contact_id" TEXT,
  "notes"               TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "property_works_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "property_works"
  ADD CONSTRAINT "property_works_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_works"
  ADD CONSTRAINT "property_works_zone_id_fkey"
  FOREIGN KEY ("zone_id") REFERENCES "property_zones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "property_works_property_id_idx" ON "property_works"("property_id");
CREATE INDEX "property_works_zone_id_idx" ON "property_works"("zone_id");

-- PropertyRentalIncome
CREATE TABLE "property_rental_incomes" (
  "id"          TEXT NOT NULL,
  "owner_id"    TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "amount"      DECIMAL(12,2) NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL,
  "tenant_name" TEXT,
  "notes"       TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "property_rental_incomes_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "property_rental_incomes"
  ADD CONSTRAINT "property_rental_incomes_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_rental_incomes"
  ADD CONSTRAINT "property_rental_incomes_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "property_rental_incomes_owner_id_idx" ON "property_rental_incomes"("owner_id");
CREATE INDEX "property_rental_incomes_property_id_idx" ON "property_rental_incomes"("property_id");

-- Budget
CREATE TABLE "budgets" (
  "id"              TEXT NOT NULL,
  "owner_id"        TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "amount"          DECIMAL(12,2) NOT NULL,
  "period"          TEXT NOT NULL DEFAULT 'month',
  "start_date"      TIMESTAMP(3) NOT NULL,
  "end_date"        TIMESTAMP(3),
  "category_id"     TEXT,
  "target_type"     TEXT,
  "target_id"       TEXT,
  "alert_threshold" INTEGER NOT NULL DEFAULT 100,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "budgets_owner_id_idx" ON "budgets"("owner_id");
CREATE INDEX "budgets_category_id_idx" ON "budgets"("category_id");
CREATE INDEX "budgets_target_type_target_id_idx" ON "budgets"("target_type", "target_id");
