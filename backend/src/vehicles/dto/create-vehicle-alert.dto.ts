import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateVehicleAlertDto {
  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
