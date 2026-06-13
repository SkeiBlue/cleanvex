import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  INTERVENTION_EXECUTORS,
  INTERVENTION_STATUSES,
} from './create-intervention.dto';
import type {
  InterventionExecutor,
  InterventionStatus,
} from './create-intervention.dto';

/**
 * Lot A — édition complète d'une intervention.
 * Tous les champs sont optionnels : le même endpoint sert à un simple
 * changement de statut (ex: { status: 'fait', mileage }) comme à une
 * édition complète depuis le formulaire.
 */
export class UpdateInterventionDto {
  @IsOptional()
  @IsIn(INTERVENTION_STATUSES)
  status?: InterventionStatus;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

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
  @IsIn(INTERVENTION_EXECUTORS)
  executor?: InterventionExecutor;

  @IsOptional()
  @IsString()
  professionalName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

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
}
