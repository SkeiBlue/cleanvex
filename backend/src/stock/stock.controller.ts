import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { toCsv } from '../core/csv.helper';
import { ConsumeStockDto } from './dto/consume-stock.dto';
import { MovementsQueryDto } from './dto/movements-query.dto';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { CreateToolLoanDto } from './dto/create-tool-loan.dto';
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

  @Post('items/import.csv')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async importCsv(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const content = file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new BadRequestException('Empty CSV');
    const headers = lines[0]
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/["\s]/g, ''));
    const col = (row: string[], key: string) => {
      const i = headers.indexOf(key);
      return i >= 0 ? (row[i]?.trim().replace(/^"|"$/g, '') ?? '') : '';
    };
    let created = 0;
    const errors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      const name = col(row, 'name') || col(row, 'nom');
      if (!name) {
        errors.push(`Ligne ${i + 1}: nom manquant`);
        continue;
      }
      try {
        await this.stock.createItem(req.user.id, {
          name,
          category: col(row, 'category') || col(row, 'categorie') || 'autre',
          unit: col(row, 'unit') || col(row, 'unite') || 'unit',
          quantity:
            col(row, 'quantity') || col(row, 'quantite')
              ? Number(col(row, 'quantity') || col(row, 'quantite'))
              : 0,
          valueAmount:
            col(row, 'value') || col(row, 'valeur') || col(row, 'valueamount')
              ? Number(
                  col(row, 'value') ||
                    col(row, 'valeur') ||
                    col(row, 'valueamount'),
                )
              : undefined,
          location:
            col(row, 'location') || col(row, 'localisation') || undefined,
          reference: col(row, 'reference') || col(row, 'ref') || undefined,
          supplier:
            col(row, 'supplier') || col(row, 'fournisseur') || undefined,
          notes: col(row, 'notes') || col(row, 'note') || undefined,
          thresholdEnabled: false,
        });
        created++;
      } catch (e) {
        errors.push(`Ligne ${i + 1}: ${(e as Error).message}`);
      }
    }
    return { created, errors, total: lines.length - 1 };
  }

  @Get('items/export.csv')
  async exportCsv(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const items = (await this.stock.items(req.user.id)) as Record<
      string,
      unknown
    >[];
    const rows = items.map((i) => ({
      name: i['name'],
      category: i['category'],
      unit: i['unit'],
      quantity: i['quantity'],
      location: i['location'] ?? '',
      value: i['valueAmount'] ?? '',
      threshold: i['threshold'] ?? '',
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="stock_${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send('﻿' + toCsv(rows));
  }

  @Get('items')
  items(@Req() req: AuthenticatedRequest) {
    return this.stock.items(req.user.id);
  }

  @Post('items')
  createItem(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateStockItemDto,
  ) {
    return this.stock.createItem(req.user.id, dto);
  }

  @Get('movements')
  movements(
    @Req() req: AuthenticatedRequest,
    @Query() query: MovementsQueryDto,
  ) {
    return this.stock.movements(req.user.id, query);
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

  // ── ToolLoan ──────────────────────────────────────────────────────────────

  @Get('loans')
  loans(@Req() req: AuthenticatedRequest) {
    return this.stock.loans(req.user.id);
  }

  @Post('loans')
  createLoan(@Req() req: AuthenticatedRequest, @Body() dto: CreateToolLoanDto) {
    return this.stock.createLoan(req.user.id, dto);
  }

  @Patch('loans/:id/return')
  returnLoan(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.stock.returnLoan(req.user.id, id);
  }

  @Delete('loans/:id')
  @HttpCode(204)
  deleteLoan(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.stock.deleteLoan(req.user.id, id);
  }
}
