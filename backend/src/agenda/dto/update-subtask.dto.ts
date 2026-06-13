import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSubtaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
