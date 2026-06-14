import { IsOptional, IsString } from 'class-validator';

export class CreatePropertyZoneDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
