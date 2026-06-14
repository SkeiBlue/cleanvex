-- Sprint 1 -- Normalisation des valeurs `type` et `status` des vehicules
-- pour s'aligner sur le vocabulaire officiel du CDC.
-- Pas de changement de schema : les colonnes restent en `text`.

-- Types : moto -> motorcycle, van -> utility (autres inchanges)
UPDATE "vehicles" SET "type" = 'motorcycle' WHERE "type" = 'moto';
UPDATE "vehicles" SET "type" = 'utility'    WHERE "type" = 'van';

-- Statuts : active/parked -> in_use, repair -> restoration (sold inchange)
UPDATE "vehicles" SET "status" = 'in_use'      WHERE "status" IN ('active', 'parked', 'actif', 'gare');
UPDATE "vehicles" SET "status" = 'restoration' WHERE "status" IN ('repair', 'en reparation');