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

export class UpdateBudgetDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsIn(['week', 'month', 'year', 'custom'])
  period?: 'week' | 'month' | 'year' | 'custom';
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsIn(['vehicle', 'property', 'global'])
  targetType?: 'vehicle' | 'property' | 'global' | null;
  @IsOptional() @IsString() targetId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(500) alertThreshold?: number;
}
