import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export const VEHICLE_ALERT_STATUSES = ['open', 'closed', 'resolved'] as const;
export type VehicleAlertStatus = (typeof VEHICLE_ALERT_STATUSES)[number];

export class CreateVehicleAlertDto {
  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(VEHICLE_ALERT_STATUSES)
  status?: VehicleAlertStatus;
}
