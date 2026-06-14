import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @MaxLength(64)
  label!: string;

  @IsString()
  @MaxLength(16)
  symbol!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string;
}
