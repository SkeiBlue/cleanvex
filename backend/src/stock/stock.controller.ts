import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConsumeStockDto } from './dto/consume-stock.dto';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { PurchaseStockDto } from './dto/purchase-stock.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { StockService } from './stock.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('items')
  items(@Req() req: AuthenticatedRequest) {
    return this.stock.items(req.user.id);
  }

  @Post('items')
  createItem(@Req() req: AuthenticatedRequest, @Body() dto: CreateStockItemDto) {
    return this.stock.createItem(req.user.id, dto);
  }

  @Get('movements')
  movements(@Req() req: AuthenticatedRequest) {
    return this.stock.movements(req.user.id);
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStockItemDto,
  ) {
    return this.stock.updateItem(req.user.id, id, dto);
  }

  @Delete('items/:id')
  @HttpCode(204)
  deleteItem(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.stock.deleteItem(req.user.id, id);
  }

  @Post('items/:id/purchase')
  purchase(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: PurchaseStockDto,
  ) {
    return this.stock.purchase(req.user.id, id, dto);
  }

  @Post('items/:id/consume')
  consume(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ConsumeStockDto,
  ) {
    return this.stock.consume(req.user.id, id, dto);
  }
}
