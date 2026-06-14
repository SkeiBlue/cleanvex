import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Lot A — catégories d'intervention (liste indicative, champ libre côté DB).
export const INTERVENTION_CATEGORIES = [
  'vidange',
  'freinage',
  'pneus',
  'distribution',
  'revision',
  'reparation',
  'carrosserie',
  'autre',
] as const;

/**
 * Pièce du stock à consommer en même temps que la création de l'intervention.
 * Décrémente le stock + crée un StockMovement lié dans la même transaction
 * pour garantir la cohérence stock ↔ travail véhicule.
 */
export class InterventionStockUsageDto {
  @IsString()
  stockItemId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;
}

// Plusieurs vocabulaires coexistent dans le code historique : on accepte
// les deux pour ne rien casser. 'fait' / 'done' sont équivalents (cf.
// isDone côté front), 'a-faire' / 'planned' aussi, 'en-cours' est utilisé
// uniquement côté UI nouveau.
export const INTERVENTION_STATUSES = [
  'planned',
  'done',
  'fait',
  'bloque',
  'a-faire',
  'en-cours',
  // Vocabulaire EN utilisé côté front (Sprint 1).
  'todo',
  'in_progress',
  'waiting',
  'cancelled',
] as const;

// V1 — Carnet d'entretien : qui a réalisé le travail.
// 'self' = fait par l'utilisateur. 'pro' = délégué à un pro (nom optionnel).
export const INTERVENTION_EXECUTORS = ['self', 'pro'] as const;
export type InterventionExecutor = (typeof INTERVENTION_EXECUTORS)[number];
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

export class CreateInterventionDto {
  @IsString()
  title!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costAmount?: number;

  @IsOptional()
  @IsIn(INTERVENTION_STATUSES)
  status?: InterventionStatus;

  @IsOptional()
  @IsIn(INTERVENTION_EXECUTORS)
  executor?: InterventionExecutor;

  @IsOptional()
  @IsString()
  professionalName?: string;

  // Sprint 2 — lien Contact transverse (garage/pro). Optionnel ; coexiste
  // avec professionalName (texte libre conservé).
  @IsOptional()
  @IsString()
  professionalContactId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Lot A — enrichissements
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyMileage?: number;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  nextDueMileage?: number;

  // Lot A — option « enregistrer la dépense en Finances » (dégradable :
  // ignorée si le module Finances est désactivé). Si activé et coût > 0,
  // crée une financial_transaction liée (source_module=vehicles).
  @IsOptional()
  @IsBoolean()
  recordInFinance?: boolean;

  @IsOptional()
  @IsString()
  financeAccountId?: string;

  @IsOptional()
  @IsString()
  financeCategoryId?: string;

  // Crée en plus une tâche dans le module Agenda (dueDate = date de
  // l'intervention). Dégradable : ignoré silencieusement si le module
  // Agenda est désactivé.
  @IsOptional()
  @IsBoolean()
  scheduleOnAgenda?: boolean;

  // S2 — liste optionnelle de pièces du stock à consommer pour ce travail.
  // Le backend les retire du stock + crée un StockMovement par usage dans
  // la même transaction que la création de l'intervention.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterventionStockUsageDto)
  stockUsages?: InterventionStockUsageDto[];
}
