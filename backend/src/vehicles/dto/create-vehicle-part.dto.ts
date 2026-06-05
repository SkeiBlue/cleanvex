import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVehiclePartDto {
  @IsString() name: string;
  @IsOptional() @IsNumber() @Min(1) quantity?: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() urgency?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() dimension?: string;
  @IsOptional() @IsNumber() @Min(0) estimatedPrice?: number;
  @IsOptional() @IsNumber() @Min(0) realPrice?: number;
  @IsOptional() @IsString() link?: string;
  @IsOptional() @IsString() comment?: string;
}
