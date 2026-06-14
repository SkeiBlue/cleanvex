import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateToolLoanDto {
  @IsNotEmpty()
  @IsString()
  stockItemId: string;

  // Sprint 2 — borrowerName devient optionnel (au moins l'un des deux est
  // requis : borrowerName ou borrowerContactId, vérifié côté service).
  @IsOptional()
  @IsString()
  borrowerName?: string;

  // Sprint 2 — lien Contact (emprunteur) optionnel.
  @IsOptional()
  @IsString()
  borrowerContactId?: string;

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
