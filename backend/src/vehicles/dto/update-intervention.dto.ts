import { IsIn } from 'class-validator';
import { INTERVENTION_STATUSES } from './create-intervention.dto';
import type { InterventionStatus } from './create-intervention.dto';

export class UpdateInterventionDto {
  @IsIn(INTERVENTION_STATUSES)
  status!: InterventionStatus;
}
