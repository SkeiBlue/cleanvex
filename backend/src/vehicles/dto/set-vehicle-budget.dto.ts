import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class SetVehicleBudgetDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  // Pour l'instant seul "total" est géré côté UI ; champ accepté pour
  // compatibilité future (monthly/yearly) sans changer le contrat d'API.
  @IsOptional()
  @IsIn(['total', 'monthly', 'yearly'])
  periodType?: 'total' | 'monthly' | 'yearly';
}
