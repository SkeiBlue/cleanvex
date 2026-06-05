import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConsumeStockDto {
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valueAmount?: number;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
