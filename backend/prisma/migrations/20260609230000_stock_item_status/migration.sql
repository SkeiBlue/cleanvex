-- S1 — Statut "à acheter" sur les articles stock.
-- Permet de marquer un article comme intention d'achat (wishlist) avant
-- de réellement l'avoir en quantité positive en stock.
ALTER TABLE "stock_items" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'in-stock';
