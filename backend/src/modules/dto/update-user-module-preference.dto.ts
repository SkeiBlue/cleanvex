import { IsBoolean } from 'class-validator';

export class UpdateUserModulePreferenceDto {
  @IsBoolean()
  isVisible!: boolean;
}
