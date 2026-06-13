import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  /** Code TOTP 6 chiffres — requis si 2FA activé */
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}
