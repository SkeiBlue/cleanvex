import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePropertyWorkDto {
  @IsString()
  title!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() zoneId?: string;
  @IsOptional() @IsIn(['planned', 'in_progress', 'done', 'cancelled'])
  status?: 'planned' | 'in_progress' | 'done' | 'cancelled';
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  @IsOptional() @IsNumber() @Min(0) budgetAmount?: number;
  @IsOptional() @IsNumber() @Min(0) actualAmount?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() supplierContactId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdatePropertyWorkDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() zoneId?: string | null;
  @IsOptional() @IsIn(['planned', 'in_progress', 'done', 'cancelled'])
  status?: 'planned' | 'in_progress' | 'done' | 'cancelled';
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  @IsOptional() @IsNumber() @Min(0) budgetAmount?: number | null;
  @IsOptional() @IsNumber() @Min(0) actualAmount?: number | null;
  @IsOptional() @IsDateString() startDate?: string | null;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsOptional() @IsString() supplierContactId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}
