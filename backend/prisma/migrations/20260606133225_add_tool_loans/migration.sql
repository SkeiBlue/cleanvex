-- CreateTable
CREATE TABLE "tool_loans" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "borrower_name" TEXT NOT NULL,
    "loan_date" TIMESTAMP(3) NOT NULL,
    "expected_return_date" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_loans_owner_id_idx" ON "tool_loans"("owner_id");

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
