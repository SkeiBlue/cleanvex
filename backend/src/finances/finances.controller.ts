import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
}
