import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
  'planned', 'done', 'fait', 'bloque',
  'a-faire', 'en-cours',
] as const;
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
  @IsString()
  notes?: string;

  // S2 — liste optionnelle de pièces du stock à consommer pour ce travail.
  // Le backend les retire du stock + crée un StockMovement par usage dans
  // la même transaction que la création de l'intervention.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterventionStockUsageDto)
  stockUsages?: InterventionStockUsageDto[];
}
