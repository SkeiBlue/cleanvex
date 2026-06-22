import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { toCsv } from '../core/csv.helper';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { CreateMileageLogDto } from './dto/create-mileage-log.dto';
import { CreateVehicleAlertDto } from './dto/create-vehicle-alert.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { CreateVehiclePartDto } from './dto/create-vehicle-part.dto';
import { LinkVehicleDocumentDto } from './dto/link-vehicle-document.dto';
import { SetVehicleBudgetDto } from './dto/set-vehicle-budget.dto';
import { UpdateInterventionDto } from './dto/update-intervention.dto';
import { UpdateVehicleAlertDto } from './dto/update-vehicle-alert.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateVehiclePartDto } from './dto/update-vehicle-part.dto';
import { VehiclesService } from './vehicles.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get('export.csv')
  async exportCsv(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const vehicles = await this.vehicles.list(req.user.id);
    const rows = vehicles.flatMap(
      (v: Record<string, unknown> & { interventions?: unknown[] }) => {
        const base = {
          id: v['id'],
          name: v['name'],
          type: v['type'],
          status: v['status'],
          brand: v['brand'] ?? '',
          model: v['model'] ?? '',
          year: v['year'] ?? '',
          mileage: v['mileage'],
          registration: v['registration'] ?? '',
        };
        if (
          !Array.isArray(v['interventions']) ||
          v['interventions'].length === 0
        )
          return [base];
        return (v['interventions'] as Record<string, unknown>[]).map((i) => ({
          ...base,
          interv_title: i['title'],
          interv_date: i['date'],
          interv_status: i['status'],
          interv_cost: i['costAmount'] ?? '',
        }));
      },
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vehicules_${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send('﻿' + toCsv(rows));
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.vehicles.list(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateVehicleDto, @Req() req: AuthenticatedRequest) {
    return this.vehicles.create(req.user.id, dto);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.vehicles.get(req.user.id, id);
  }

  // LOT 4 — budget véhicule (persisté en base, plus de localStorage).
  @Get(':id/budget')
  getBudget(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.vehicles.getBudget(req.user.id, id);
  }

  @Put(':id/budget')
  setBudget(
    @Param('id') id: string,
    @Body() dto: SetVehicleBudgetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.setBudget(req.user.id, id, dto.amount);
  }

  @Delete(':id/budget')
  @HttpCode(200)
  deleteBudget(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.vehicles.deleteBudget(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.update(req.user.id, id, dto);
  }

  @Post(':id/mileage')
  addMileageLog(
    @Param('id') id: string,
    @Body() dto: CreateMileageLogDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.addMileageLog(req.user.id, id, dto);
  }

  @Post(':id/interventions')
  addIntervention(
    @Param('id') id: string,
    @Body() dto: CreateInterventionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.addIntervention(req.user.id, id, dto);
  }

  @Post(':id/alerts')
  addAlert(
    @Param('id') id: string,
    @Body() dto: CreateVehicleAlertDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.addAlert(req.user.id, id, dto);
  }

  @Post(':id/documents')
  linkDocument(
    @Param('id') id: string,
    @Body() dto: LinkVehicleDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.linkDocument(
      req.user.id,
      id,
      dto.documentId,
      dto.context,
    );
  }

  @Patch(':id/alerts/:alertId')
  updateAlert(
    @Param('id') id: string,
    @Param('alertId') alertId: string,
    @Body() dto: UpdateVehicleAlertDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.updateAlert(req.user.id, id, alertId, dto.status);
  }

  @Delete(':id/alerts/:alertId')
  @HttpCode(204)
  deleteAlert(
    @Param('id') id: string,
    @Param('alertId') alertId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.deleteAlert(req.user.id, id, alertId);
  }

  // Lot B — créer une tâche Agenda depuis une alerte/échéance.
  @Post(':id/alerts/:alertId/task')
  @HttpCode(200)
  createTaskFromAlert(
    @Param('id') id: string,
    @Param('alertId') alertId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.createTaskFromAlert(req.user.id, id, alertId);
  }

  @Get(':id/parts')
  listParts(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.vehicles.listParts(req.user.id, id);
  }

  @Post(':id/parts')
  addPart(
    @Param('id') id: string,
    @Body() dto: CreateVehiclePartDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.addPart(req.user.id, id, dto);
  }

  @Patch(':id/parts/:partId')
  updatePart(
    @Param('id') id: string,
    @Param('partId') partId: string,
    @Body() dto: UpdateVehiclePartDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.updatePart(req.user.id, id, partId, dto);
  }

  @Delete(':id/parts/:partId')
  @HttpCode(204)
  deletePart(
    @Param('id') id: string,
    @Param('partId') partId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.deletePart(req.user.id, id, partId);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteVehicle(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.vehicles.deleteVehicle(req.user.id, id);
  }

  @Patch(':id/interventions/:interventionId')
  updateIntervention(
    @Param('id') id: string,
    @Param('interventionId') interventionId: string,
    @Body() dto: UpdateInterventionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.updateIntervention(
      req.user.id,
      id,
      interventionId,
      dto,
    );
  }

  @Delete(':id/interventions/:interventionId')
  @HttpCode(204)
  deleteIntervention(
    @Param('id') id: string,
    @Param('interventionId') interventionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.deleteIntervention(req.user.id, id, interventionId);
  }

  // Lot A — rattacher une pièce jointe (facture/photo) à une intervention.
  @Post(':id/interventions/:interventionId/documents')
  linkInterventionDocument(
    @Param('id') id: string,
    @Param('interventionId') interventionId: string,
    @Body() dto: LinkVehicleDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.linkInterventionDocument(
      req.user.id,
      id,
      interventionId,
      dto.documentId,
    );
  }

  // Lot C — annuler une sortie de stock (remet la pièce en stock).
  @Delete(':id/stock-movements/:movementId')
  @HttpCode(200)
  reverseStockMovement(
    @Param('id') id: string,
    @Param('movementId') movementId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehicles.reverseStockMovement(req.user.id, id, movementId);
  }
}
