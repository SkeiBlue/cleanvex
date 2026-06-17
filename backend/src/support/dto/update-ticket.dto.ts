import { IsIn, IsOptional } from 'class-validator';

// Réservé aux administrateurs : ils pilotent le statut et la priorité.
export class UpdateTicketDto {
  @IsOptional()
  @IsIn(['open', 'pending', 'resolved', 'closed'])
  status?: string;

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string;
}
