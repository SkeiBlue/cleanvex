-- CreateTable
CREATE TABLE "vehicle_parts" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'autre',
    "status" TEXT NOT NULL DEFAULT 'a-acheter',
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "priority" TEXT NOT NULL DEFAULT 'fiabilite',
    "reference" TEXT,
    "dimension" TEXT,
    "estimated_price" DECIMAL(12,2),
    "real_price" DECIMAL(12,2),
    "link" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_parts_vehicle_id_idx" ON "vehicle_parts"("vehicle_id");

-- AddForeignKey
ALTER TABLE "vehicle_parts" ADD CONSTRAINT "vehicle_parts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
