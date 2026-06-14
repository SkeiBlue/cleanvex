import { IsString } from 'class-validator';
import { IsStrongPassword } from './password.decorator';

export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsStrongPassword() newPassword: string;
}
