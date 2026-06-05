import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePropertyEventDto {
  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsString()
  date!: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
