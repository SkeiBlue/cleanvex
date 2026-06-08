import { IsDateString, IsOptional } from 'class-validator';

export class UploadDocumentDto {
  // Optionnel : champs multipart manquant ou chaîne vide.
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
