-- S2 — Liaison fine entre un mouvement de stock et une intervention
-- véhicule. Permet d'afficher dans la fiche véhicule les pièces consommées
-- par travail précis plutôt qu'agrégées au niveau véhicule.
-- onDelete SET NULL : si l'intervention est supprimée, on garde
-- l'historique des mouvements (avec interventionId = null).
ALTER TABLE "stock_movements" ADD COLUMN "intervention_id" TEXT;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_intervention_id_fkey"
  FOREIGN KEY ("intervention_id") REFERENCES "vehicle_interventions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "stock_movements_intervention_id_idx"
  ON "stock_movements"("intervention_id");
