import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { toCsv } from '../core/csv.helper';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';
import { FinancesService } from './finances.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('finances')
export class FinancesController {
  constructor(private readonly finances: FinancesService) {}

  @Get('summary')
  summary(@Req() req: AuthenticatedRequest) {
    return this.finances.summary(req.user.id);
  }

  @Get('accounts')
  accounts(@Req() req: AuthenticatedRequest) {
    return this.finances.accounts(req.user.id);
  }

  @Post('accounts')
  createAccount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFinancialAccountDto,
  ) {
    return this.finances.createAccount(req.user.id, dto);
  }

  @Get('categories')
  categories() {
    return this.finances.categories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateFinancialCategoryDto) {
    return this.finances.createCategory(dto);
  }

  @Post('transactions/import.csv')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async importCsv(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    const text = file.buffer.toString('utf-8').replace(/^﻿/, ''); // strip BOM
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new BadRequestException('CSV vide ou sans données.');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',');
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
    });

    const accounts = await this.finances.accounts(req.user.id);
    const categories = await this.finances.categories();

    let created = 0; const errors: string[] = [];
    for (const row of rows) {
      try {
        const account = accounts.find(a => a.name.toLowerCase() === (row['account'] ?? '').toLowerCase());
        if (!account) { errors.push(`Compte inconnu: "${row['account']}"`); continue; }
        const category = categories.find(c => c.name.toLowerCase() === (row['category'] ?? '').toLowerCase());
        const amount = parseFloat(row['amount'] ?? '0');
        if (isNaN(amount) || amount <= 0) { errors.push(`Montant invalide: "${row['amount']}"`); continue; }
        const type = (row['type'] ?? '').toLowerCase();
        if (type !== 'income' && type !== 'expense') { errors.push(`Type invalide: "${row['type']}"`); continue; }
        await this.finances.createTransaction(req.user.id, {
          label: row['label'] || row['libellé'] || 'Sans libellé',
          type: type as 'income' | 'expense',
          amount,
          accountId: account.id,
          categoryId: category?.id,
          operationDate: row['date'] || new Date().toISOString().slice(0, 10),
          note: row['note'] || undefined,
        });
        created++;
      } catch (e) {
        errors.push(`Ligne ignorée: ${JSON.stringify(row)}`);
      }
    }
    return { created, errors: errors.slice(0, 20), total: rows.length };
  }

  @Get('transactions/export.csv')
  async exportCsv(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const txs = await this.finances.transactions(req.user.id) as Record<string, unknown>[];
    const rows = txs.map(t => ({
      date: t['operationDate'], type: t['type'], label: t['label'], amount: t['amount'],
      category: (t['category'] as Record<string, unknown> | null)?.['name'] ?? '',
      account:  (t['account']  as Record<string, unknown>)?.['name'] ?? '',
      status: t['status'], note: t['note'] ?? '',
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send('﻿' + toCsv(rows));
  }

  @Get('transactions')
  transactions(@Req() req: AuthenticatedRequest) {
    return this.finances.transactions(req.user.id);
  }

  @Post('transactions')
  createTransaction(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFinancialTransactionDto,
  ) {
    return this.finances.createTransaction(req.user.id, dto);
  }

  @Patch('transactions/:id')
  updateTransaction(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialTransactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.finances.updateTransaction(req.user.id, id, dto);
  }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.finances.deleteAccount(req.user.id, id);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.finances.deleteCategory(id);
  }

  @Delete('transactions/:id')
  deleteTransaction(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.finances.deleteTransaction(req.user.id, id);
  }
}
