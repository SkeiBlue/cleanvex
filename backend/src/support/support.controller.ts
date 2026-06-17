import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddMessageDto } from './dto/add-message.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { SupportService } from './support.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  listMine(@Req() req: AuthenticatedRequest) {
    return this.support.listMine(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateTicketDto, @Req() req: AuthenticatedRequest) {
    return this.support.create(req.user.id, dto);
  }

  // Vue admin : tous les tickets.
  @Get('all')
  @UseGuards(AdminGuard)
  listAll(@Query('status') status?: string) {
    return this.support.listAll(status);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.support.get(req.user.id, req.user.role === 'admin', id);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') id: string,
    @Body() dto: AddMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.support.addMessage(
      req.user.id,
      req.user.role === 'admin',
      id,
      dto,
    );
  }

  // Réservé admin : statut / priorité.
  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.support.update(id, dto);
  }
}
