import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export const SOURCE_MODULE_SLUGS = [
  'vehicles',
  'real-estate',
  'finances',
  'stock',
  'contacts',
  'general',
] as const;
export type SourceModuleSlug = (typeof SOURCE_MODULE_SLUGS)[number];

export class UploadDocumentDto {
  // Optionnel : champs multipart manquant ou chaîne vide.
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  // Sprint 5 — slug du module source pour catégorisation automatique.
  // Si absent ou inconnu, le document est rangé dans "Général".
  @IsOptional()
  @IsIn(SOURCE_MODULE_SLUGS as unknown as string[])
  sourceModule?: SourceModuleSlug;

  // Sprint 5 — catégorie explicite (prioritaire sur sourceModule).
  @IsOptional()
  @IsString()
  categoryId?: string;
}
