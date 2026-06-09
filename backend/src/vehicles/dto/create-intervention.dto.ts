import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
}
