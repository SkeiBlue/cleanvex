import { IsOptional, IsString } from 'class-validator';

export class CreateContactInteractionDto {
  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsString()
  date!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
