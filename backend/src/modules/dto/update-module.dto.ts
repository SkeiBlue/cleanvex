import { IsBoolean } from 'class-validator';

export class UpdateModuleDto {
  @IsBoolean()
  isEnabled!: boolean;
}
