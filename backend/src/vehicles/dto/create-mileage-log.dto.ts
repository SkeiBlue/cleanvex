import { IsDateString, IsInt, Min } from 'class-validator';

export class CreateMileageLogDto {
  @IsInt()
  @Min(0)
  mileage!: number;

  @IsDateString()
  date!: string;
}
