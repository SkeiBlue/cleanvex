import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_POLICY_MESSAGE =
  'Le mot de passe doit contenir au moins 8 caractères, une minuscule, une majuscule, un chiffre et un caractère spécial.';

// bcrypt tronque silencieusement au-delà de 72 octets : on plafonne donc à 72
// pour éviter une fausse impression de sécurité (cf. LOT 3).
const PASSWORD_MAX_LENGTH = 72;

// Au moins : une minuscule, une majuscule, un chiffre, un caractère spécial.
const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

/**
 * Politique de mot de passe partagée par tous les DTO qui définissent un
 * nouveau mot de passe (inscription, reset, changement, création admin…).
 * Ne pas l'appliquer au mot de passe *de connexion* (login), qui ne doit pas
 * dépendre de la politique courante.
 */
export function IsStrongPassword() {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: PASSWORD_POLICY_MESSAGE }),
    MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_POLICY_MESSAGE }),
    Matches(PASSWORD_COMPLEXITY, { message: PASSWORD_POLICY_MESSAGE }),
  );
}
