import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateFinancialTransactionDto {
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsDateString() operationDate?: string;
}
