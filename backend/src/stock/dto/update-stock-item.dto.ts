import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { STOCK_ITEM_STATUSES } from './create-stock-item.dto';
import type { StockItemStatus } from './create-stock-item.dto';

export class UpdateStockItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsIn(STOCK_ITEM_STATUSES) status?: StockItemStatus;
  @IsOptional() @IsBoolean() thresholdEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) threshold?: number;
  @IsOptional() @IsNumber() @Min(0) valueAmount?: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() supplier?: string;
  // Sprint 2 — lien Contact (fournisseur). Chaîne vide accepté pour vider.
  @IsOptional() @IsString() supplierContactId?: string;
  @IsOptional() @IsString() notes?: string;
}
