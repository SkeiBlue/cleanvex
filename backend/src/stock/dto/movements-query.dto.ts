import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../core/pagination.helper';

/**
 * Query des mouvements de stock. Hérite de la pagination globale et ajoute
 * un filtre optionnel par article : quand `stockItemId` est fourni, on
 * renvoie tout l'historique de cet article (pas de troncature à 20).
 */
export class MovementsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  stockItemId?: string;
}
