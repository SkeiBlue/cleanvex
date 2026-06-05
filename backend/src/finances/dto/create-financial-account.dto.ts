import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFinancialAccountDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;
}
