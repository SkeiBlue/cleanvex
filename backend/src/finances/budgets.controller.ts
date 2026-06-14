import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('finances/budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.budgets.list(req.user.id);
  }

  @Get('report')
  report(
    @Req() req: AuthenticatedRequest,
    @Query('period') period?: 'week' | 'month' | 'year' | 'custom',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.budgets.report(req.user.id, period, from, to);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.budgets.get(req.user.id, id);
  }

  @Post()
  create(@Body() dto: CreateBudgetDto, @Req() req: AuthenticatedRequest) {
    return this.budgets.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.budgets.update(req.user.id, id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.budgets.delete(req.user.id, id);
  }
}
