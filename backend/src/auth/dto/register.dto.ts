import { IsEmail, IsOptional, IsString } from 'class-validator';
import { IsStrongPassword } from './password.decorator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsStrongPassword()
  password!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}
