import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateBudgetDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsIn(['week', 'month', 'year', 'custom'])
  period!: 'week' | 'month' | 'year' | 'custom';

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(['vehicle', 'property', 'global'])
  targetType?: 'vehicle' | 'property' | 'global';

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  alertThreshold?: number;
}
