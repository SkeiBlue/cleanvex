import { IsString, Length, MinLength } from 'class-validator';

export class Disable2faDto {
  /** Mot de passe actuel — re-vérifié pour désactiver le 2FA. */
  @IsString()
  @MinLength(8)
  password!: string;

  /** Code TOTP 6 chiffres courant. */
  @IsString()
  @Length(6, 6)
  code!: string;
}
