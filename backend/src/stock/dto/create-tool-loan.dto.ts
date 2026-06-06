import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateToolLoanDto {
  @IsNotEmpty()
  @IsString()
  stockItemId: string;

  @IsNotEmpty()
  @IsString()
  borrowerName: string;

  @IsOptional()
  @IsDateString()
  loanDate?: string;

  @IsOptional()
  @IsDateString()
  expectedReturnDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
