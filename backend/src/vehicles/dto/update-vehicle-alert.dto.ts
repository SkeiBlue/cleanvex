import { IsIn } from 'class-validator';
import { VEHICLE_ALERT_STATUSES } from './create-vehicle-alert.dto';
import type { VehicleAlertStatus } from './create-vehicle-alert.dto';

export class UpdateVehicleAlertDto {
  @IsIn(VEHICLE_ALERT_STATUSES)
  status!: VehicleAlertStatus;
}
