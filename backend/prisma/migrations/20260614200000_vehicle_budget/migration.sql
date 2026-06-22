-- LOT 4 — budget véhicule persisté en base (remplace localStorage)

ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "budget" DECIMAL(12,2);
