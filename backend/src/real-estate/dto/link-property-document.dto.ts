import { IsOptional, IsString } from 'class-validator';

export class LinkPropertyDocumentDto {
  @IsString()
  documentId!: string;

  @IsOptional()
  @IsString()
  context?: string;
}
