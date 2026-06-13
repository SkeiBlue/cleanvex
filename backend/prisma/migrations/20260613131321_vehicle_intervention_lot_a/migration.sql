-- AlterTable
ALTER TABLE "vehicle_interventions" ADD COLUMN     "category" TEXT,
ADD COLUMN     "next_due_date" TIMESTAMP(3),
ADD COLUMN     "next_due_mileage" INTEGER,
ADD COLUMN     "warranty_mileage" INTEGER,
ADD COLUMN     "warranty_until" TIMESTAMP(3);
