-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "supplier_contact_id" TEXT;

-- AlterTable
ALTER TABLE "tool_loans" ADD COLUMN     "borrower_contact_id" TEXT,
ALTER COLUMN "borrower_name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "vehicle_interventions" ADD COLUMN     "professional_contact_id" TEXT;

-- CreateIndex
CREATE INDEX "stock_items_supplier_contact_id_idx" ON "stock_items"("supplier_contact_id");

-- CreateIndex
CREATE INDEX "tool_loans_borrower_contact_id_idx" ON "tool_loans"("borrower_contact_id");

-- CreateIndex
CREATE INDEX "vehicle_interventions_professional_contact_id_idx" ON "vehicle_interventions"("professional_contact_id");

-- AddForeignKey
ALTER TABLE "vehicle_interventions" ADD CONSTRAINT "vehicle_interventions_professional_contact_id_fkey" FOREIGN KEY ("professional_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_supplier_contact_id_fkey" FOREIGN KEY ("supplier_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_borrower_contact_id_fkey" FOREIGN KEY ("borrower_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
