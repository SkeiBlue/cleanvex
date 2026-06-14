import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  symbol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
