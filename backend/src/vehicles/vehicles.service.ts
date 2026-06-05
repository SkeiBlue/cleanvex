import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { CreateMileageLogDto } from './dto/create-mileage-log.dto';
import { CreateVehicleAlertDto } from './dto/create-vehicle-alert.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string) {
    await this.ensureVehiclesEnabled();
    return this.prisma.vehicle.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            interventions: true,
            alerts: true,
          },
        },
      },
    });
  }

  async create(ownerId: string, dto: CreateVehicleDto) {
    await this.ensureVehiclesEnabled();
    const vehicle = await this.prisma.vehicle.create({
      data: {
        ownerId,
        ...dto,
        mileage: dto.mileage ?? 0,
      },
    });

    if (vehicle.mileage > 0) {
      await this.prisma.vehicleMileageLog.create({
        data: {
          vehicleId: vehicle.id,
          mileage: vehicle.mileage,
          date: new Date(),
          sourceType: 'vehicle',
          sourceId: vehicle.id,
        },
      });
    }

    return vehicle;
  }

  async get(ownerId: string, id: string) {
    await this.ensureVehiclesEnabled();
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, ownerId },
      include: {
        mileageLogs: { orderBy: { date: 'desc' } },
        interventions: { orderBy: { date: 'desc' } },
        alerts: { orderBy: { dueDate: 'asc' } },
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const documents = await this.prisma.documentLink.findMany({
      where: { targetType: 'vehicle', targetId: id },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            visibility: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { ...vehicle, documents };
  }

  async update(ownerId: string, id: string, dto: UpdateVehicleDto) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, id);
    return this.prisma.vehicle.update({
      where: { id },
      data: dto,
    });
  }

  async addMileageLog(ownerId: string, vehicleId: string, dto: CreateMileageLogDto) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);

    const log = await this.prisma.vehicleMileageLog.create({
      data: {
        vehicleId,
        mileage: dto.mileage,
        date: new Date(dto.date),
        sourceType: 'manual',
      },
    });

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { mileage: dto.mileage },
    });

    return log;
  }

  async addIntervention(ownerId: string, vehicleId: string, dto: CreateInterventionDto) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);

    return this.prisma.vehicleIntervention.create({
      data: {
        vehicleId,
        title: dto.title,
        date: new Date(dto.date),
        mileage: dto.mileage,
        timeMinutes: dto.timeMinutes,
        costAmount: dto.costAmount,
        status: dto.status ?? 'planned',
        notes: dto.notes,
      },
    });
  }

  async addAlert(ownerId: string, vehicleId: string, dto: CreateVehicleAlertDto) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);

    return this.prisma.vehicleAlert.create({
      data: {
        vehicleId,
        type: dto.type,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status ?? 'open',
      },
    });
  }

  async linkDocument(
    ownerId: string,
    vehicleId: string,
    documentId: string,
    context = 'vehicle',
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, ownerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.prisma.documentLink.create({
      data: {
        documentId,
        targetType: 'vehicle',
        targetId: vehicleId,
        context,
      },
    });
  }

  async updateAlert(ownerId: string, vehicleId: string, alertId: string, status: string) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    return this.prisma.vehicleAlert.update({
      where: { id: alertId },
      data: { status },
    });
  }

  async deleteAlert(ownerId: string, vehicleId: string, alertId: string) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.prisma.vehicleAlert.delete({ where: { id: alertId } });
  }

  async deleteVehicle(ownerId: string, id: string) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, id);
    await this.prisma.vehicle.delete({ where: { id } });
  }

  async updateIntervention(ownerId: string, vehicleId: string, interventionId: string, status: string) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    return this.prisma.vehicleIntervention.update({
      where: { id: interventionId },
      data: { status },
    });
  }

  async deleteIntervention(ownerId: string, vehicleId: string, interventionId: string) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.prisma.vehicleIntervention.delete({ where: { id: interventionId } });
  }

  private async ensureVehicleExists(ownerId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, ownerId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle;
  }

  private async ensureVehiclesEnabled() {
    const module = await this.prisma.module.findUnique({
      where: { key: 'vehicles' },
    });

    if (module && !module.isEnabled) {
      throw new ForbiddenException('Vehicles module is disabled');
    }
  }
}
