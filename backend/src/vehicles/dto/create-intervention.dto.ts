import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// 'fait' et 'done' coexistent dans le code historique (cf. isDone côté front).
export const INTERVENTION_STATUSES = ['planned', 'done', 'fait', 'bloque'] as const;
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
