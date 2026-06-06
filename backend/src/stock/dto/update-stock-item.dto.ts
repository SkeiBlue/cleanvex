import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateStockItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsBoolean() thresholdEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) threshold?: number;
  @IsOptional() @IsNumber() @Min(0) valueAmount?: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsString() notes?: string;
}
