import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRentalIncomeDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  receivedAt!: string;

  @IsOptional() @IsString() tenantName?: string;
  @IsOptional() @IsString() notes?: string;
}
