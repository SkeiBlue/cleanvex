/*
  Warnings:

  - Added the required column `owner_id` to the `financial_categories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "financial_categories" ADD COLUMN     "owner_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "vehicles" ALTER COLUMN "purchase_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "insurance_expiry" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "ct_expiry" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "financial_categories_owner_id_idx" ON "financial_categories"("owner_id");

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
