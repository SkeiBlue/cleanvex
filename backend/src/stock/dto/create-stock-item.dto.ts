import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// Valeurs autorisées pour StockItem.status. Réexporté par les autres DTOs
// (update) pour rester une source unique de vérité.
export const STOCK_ITEM_STATUSES = ['in-stock', 'to-buy'] as const;
export type StockItemStatus = (typeof STOCK_ITEM_STATUSES)[number];

export class CreateStockItemDto {
  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsIn(STOCK_ITEM_STATUSES)
  status?: StockItemStatus;

  @IsOptional()
  @IsBoolean()
  thresholdEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valueAmount?: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
