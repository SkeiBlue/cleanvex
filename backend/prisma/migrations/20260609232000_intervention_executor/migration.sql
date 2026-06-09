-- V1 — Carnet d'entretien : champs executor + professionalName sur les
-- interventions véhicule pour distinguer ce qu'on a fait soi-même de
-- ce qui a été délégué à un professionnel.
ALTER TABLE "vehicle_interventions"
  ADD COLUMN "executor" TEXT NOT NULL DEFAULT 'self',
  ADD COLUMN "professional_name" TEXT;
