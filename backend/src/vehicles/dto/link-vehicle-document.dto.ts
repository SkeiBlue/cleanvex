import { IsOptional, IsString } from 'class-validator';

export class LinkVehicleDocumentDto {
  @IsString()
  documentId!: string;

  @IsOptional()
  @IsString()
  context?: string;
}
