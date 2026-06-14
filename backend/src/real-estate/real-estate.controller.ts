import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePropertyEventDto } from './dto/create-property-event.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreatePropertyZoneDto } from './dto/create-property-zone.dto';
import {
  CreatePropertyWorkDto,
  UpdatePropertyWorkDto,
} from './dto/create-property-work.dto';
import { CreateRentalIncomeDto } from './dto/create-rental-income.dto';
import { LinkPropertyDocumentDto } from './dto/link-property-document.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { RealEstateService } from './real-estate.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('real-estate')
export class RealEstateController {
  constructor(private readonly realEstate: RealEstateService) {}

  @Get('properties')
  list(@Req() req: AuthenticatedRequest) {
    return this.realEstate.list(req.user.id);
  }

  @Post('properties')
  create(@Body() dto: CreatePropertyDto, @Req() req: AuthenticatedRequest) {
    return this.realEstate.create(req.user.id, dto);
  }

  @Get('properties/:id')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.realEstate.get(req.user.id, id);
  }

  @Patch('properties/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.update(req.user.id, id, dto);
  }

  @Delete('properties/:id')
  @HttpCode(204)
  delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.realEstate.delete(req.user.id, id);
  }

  @Post('properties/:id/events')
  addEvent(
    @Param('id') id: string,
    @Body() dto: CreatePropertyEventDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.addEvent(req.user.id, id, dto);
  }

  @Delete('properties/:id/events/:eventId')
  @HttpCode(204)
  deleteEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.deleteEvent(req.user.id, id, eventId);
  }

  @Post('properties/:id/documents')
  linkDocument(
    @Param('id') id: string,
    @Body() dto: LinkPropertyDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.linkDocument(
      req.user.id,
      id,
      dto.documentId,
      dto.context,
    );
  }

  /* ── Zones ── */
  @Get('properties/:id/zones')
  listZones(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.realEstate.listZones(req.user.id, id);
  }

  @Post('properties/:id/zones')
  createZone(
    @Param('id') id: string,
    @Body() dto: CreatePropertyZoneDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.createZone(req.user.id, id, dto);
  }

  @Delete('properties/:id/zones/:zoneId')
  @HttpCode(204)
  deleteZone(
    @Param('id') id: string,
    @Param('zoneId') zoneId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.deleteZone(req.user.id, id, zoneId);
  }

  /* ── Travaux ── */
  @Get('properties/:id/works')
  listWorks(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.realEstate.listWorks(req.user.id, id);
  }

  @Post('properties/:id/works')
  createWork(
    @Param('id') id: string,
    @Body() dto: CreatePropertyWorkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.createWork(req.user.id, id, dto);
  }

  @Patch('properties/:id/works/:workId')
  updateWork(
    @Param('id') id: string,
    @Param('workId') workId: string,
    @Body() dto: UpdatePropertyWorkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.updateWork(req.user.id, id, workId, dto);
  }

  @Delete('properties/:id/works/:workId')
  @HttpCode(204)
  deleteWork(
    @Param('id') id: string,
    @Param('workId') workId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.deleteWork(req.user.id, id, workId);
  }

  /* ── Revenus locatifs ── */
  @Get('properties/:id/rental-incomes')
  listRentalIncomes(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.realEstate.listRentalIncomes(req.user.id, id);
  }

  @Post('properties/:id/rental-incomes')
  createRentalIncome(
    @Param('id') id: string,
    @Body() dto: CreateRentalIncomeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.createRentalIncome(req.user.id, id, dto);
  }

  @Delete('properties/:id/rental-incomes/:incomeId')
  @HttpCode(204)
  deleteRentalIncome(
    @Param('id') id: string,
    @Param('incomeId') incomeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.deleteRentalIncome(req.user.id, id, incomeId);
  }
}
