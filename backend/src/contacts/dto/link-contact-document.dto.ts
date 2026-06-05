import { IsOptional, IsString } from 'class-validator';

export class LinkContactDocumentDto {
  @IsString()
  documentId!: string;

  @IsOptional()
  @IsString()
  context?: string;
}
