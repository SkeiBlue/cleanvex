import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockItemDto {
  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsString()
  unit!: string;

  @IsOptional() @IsNumber() @Min(0)
  quantity?: number;

  @IsOptional() @IsBoolean()
  thresholdEnabled?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  threshold?: number;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsNumber() @Min(0)
  valueAmount?: number;

  @IsOptional() @IsString()
  reference?: string;

  @IsOptional() @IsString()
  supplier?: string;

  @IsOptional() @IsString()
  notes?: string;
}
