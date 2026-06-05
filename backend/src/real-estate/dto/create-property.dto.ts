import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  surface?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  rooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
