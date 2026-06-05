import { IsOptional, IsString } from 'class-validator';

export class CreateFinancialCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  color?: string;
}
