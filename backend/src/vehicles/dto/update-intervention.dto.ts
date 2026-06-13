import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import {
  INTERVENTION_EXECUTORS,
  INTERVENTION_STATUSES,
} from './create-intervention.dto';
import type {
  InterventionExecutor,
  InterventionStatus,
} from './create-intervention.dto';

export class UpdateInterventionDto {
  @IsIn(INTERVENTION_STATUSES)
  status!: InterventionStatus;

  // V3 — Optionnel : le kilométrage du véhicule au moment de la validation
  // du travail. Permet de demander le km à la fin (quand la donnée a un
  // sens) plutôt qu'à la création.
  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  // V1 — Permettre la mise à jour du carnet d'entretien après coup.
  @IsOptional()
  @IsIn(INTERVENTION_EXECUTORS)
  executor?: InterventionExecutor;

  @IsOptional()
  @IsString()
  professionalName?: string;
}
