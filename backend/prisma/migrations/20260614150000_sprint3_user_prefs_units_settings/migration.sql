-- Sprint 3 — préférences modules par utilisateur, unités personnalisées,
-- réglages globaux (inscription publique notamment).

CREATE TABLE "user_module_preferences" (
  "id"          TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "module_key"  TEXT NOT NULL,
  "is_visible"  BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_module_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_module_preferences_user_id_module_key_key"
  ON "user_module_preferences"("user_id", "module_key");
CREATE INDEX "user_module_preferences_user_id_idx"
  ON "user_module_preferences"("user_id");

ALTER TABLE "user_module_preferences"
  ADD CONSTRAINT "user_module_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "units" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT,
  "label"      TEXT NOT NULL,
  "symbol"     TEXT NOT NULL,
  "type"       TEXT NOT NULL DEFAULT 'quantity',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "units_user_id_label_key" ON "units"("user_id", "label");
CREATE INDEX "units_user_id_idx" ON "units"("user_id");

ALTER TABLE "units"
  ADD CONSTRAINT "units_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "app_settings" (
  "id"         TEXT NOT NULL,
  "key"        TEXT NOT NULL,
  "value_json" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");
