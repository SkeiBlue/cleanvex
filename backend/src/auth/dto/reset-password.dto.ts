import { IsString } from 'class-validator';
import { IsStrongPassword } from './password.decorator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsStrongPassword()
  newPassword!: string;
}
