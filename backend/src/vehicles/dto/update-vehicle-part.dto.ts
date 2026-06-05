import { PartialType } from '@nestjs/mapped-types';
import { CreateVehiclePartDto } from './create-vehicle-part.dto';

export class UpdateVehiclePartDto extends PartialType(CreateVehiclePartDto) {}
