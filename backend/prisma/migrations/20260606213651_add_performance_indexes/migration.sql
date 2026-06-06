-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_module_key_idx" ON "activity_logs"("module_key");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "financial_transactions_owner_id_operation_date_idx" ON "financial_transactions"("owner_id", "operation_date" DESC);

-- CreateIndex
CREATE INDEX "notifications_owner_id_is_read_idx" ON "notifications"("owner_id", "is_read");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "subtasks_task_id_idx" ON "subtasks"("task_id");

-- CreateIndex
CREATE INDEX "vehicle_alerts_vehicle_id_idx" ON "vehicle_alerts"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_interventions_vehicle_id_idx" ON "vehicle_interventions"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_mileage_logs_vehicle_id_idx" ON "vehicle_mileage_logs"("vehicle_id");
