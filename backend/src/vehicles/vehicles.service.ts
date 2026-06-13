import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { CreateMileageLogDto } from './dto/create-mileage-log.dto';
import { CreateVehicleAlertDto } from './dto/create-vehicle-alert.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { CreateVehiclePartDto } from './dto/create-vehicle-part.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateVehiclePartDto } from './dto/update-vehicle-part.dto';

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
    const { purchaseDate, insuranceExpiry, ctExpiry, ...rest } = dto;
    const vehicle = await this.prisma.vehicle.create({
      data: {
        ownerId,
        ...rest,
        mileage: dto.mileage ?? 0,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        insuranceExpiry: insuranceExpiry
          ? new Date(insuranceExpiry)
          : undefined,
        ctExpiry: ctExpiry ? new Date(ctExpiry) : undefined,
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

    await this.autoCreateExpiryAlerts(
      vehicle.id,
      vehicle.insuranceExpiry,
      vehicle.ctExpiry,
    );

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

    // Sorties stock imputées à ce véhicule
    const stockMovements = await this.prisma.stockMovement.findMany({
      where: { targetType: 'vehicle', targetId: id },
      include: { stockItem: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return { ...vehicle, documents, stockMovements };
  }

  async update(ownerId: string, id: string, dto: UpdateVehicleDto) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, id);
    const { purchaseDate, insuranceExpiry, ctExpiry, ...rest } = dto;

    const insuranceDate =
      insuranceExpiry !== undefined
        ? insuranceExpiry
          ? new Date(insuranceExpiry)
          : null
        : undefined;
    const ctDate =
      ctExpiry !== undefined
        ? ctExpiry
          ? new Date(ctExpiry)
          : null
        : undefined;

    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: {
        ...rest,
        ...(purchaseDate !== undefined && {
          purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        }),
        ...(insuranceDate !== undefined && { insuranceExpiry: insuranceDate }),
        ...(ctDate !== undefined && { ctExpiry: ctDate }),
      },
    });

    await this.autoCreateExpiryAlerts(id, insuranceDate, ctDate);

    return vehicle;
  }

  async addMileageLog(
    ownerId: string,
    vehicleId: string,
    dto: CreateMileageLogDto,
  ) {
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

  async addIntervention(
    ownerId: string,
    vehicleId: string,
    dto: CreateInterventionDto,
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);

    // S2 — Si l'utilisateur a coché "Inclure des pièces du stock" dans la modal,
    // on consomme chaque pièce + on lie son StockMovement à l'intervention
    // créée, le tout dans une seule transaction Prisma pour garantir la
    // cohérence (rollback complet si une pièce est en stock insuffisant ou
    // appartient à un autre utilisateur).
    const usages = dto.stockUsages ?? [];

    if (usages.length === 0) {
      return this.prisma.vehicleIntervention.create({
        data: {
          vehicleId,
          title: dto.title,
          date: new Date(dto.date),
          mileage: dto.mileage,
          timeMinutes: dto.timeMinutes,
          costAmount: dto.costAmount,
          status: dto.status ?? 'planned',
          executor: dto.executor ?? 'self',
          professionalName: dto.professionalName,
          notes: dto.notes,
        },
      });
    }

    // Pré-charge les items pour valider ownership + stock suffisant avant
    // d'ouvrir la transaction (réponse 400 propre plutôt que rollback).
    const itemIds = Array.from(new Set(usages.map((u) => u.stockItemId)));
    const items = await this.prisma.stockItem.findMany({
      where: { id: { in: itemIds }, ownerId },
    });
    const itemById = new Map(items.map((i) => [i.id, i]));
    for (const usage of usages) {
      const item = itemById.get(usage.stockItemId);
      if (!item) {
        throw new NotFoundException(
          `Pièce stock introuvable : ${usage.stockItemId}`,
        );
      }
      if (Number(item.quantity) < usage.quantity) {
        throw new BadRequestException(
          `Stock insuffisant pour "${item.name}" : ${Number(item.quantity)} ${item.unit} disponibles, ${usage.quantity} demandés.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const intervention = await tx.vehicleIntervention.create({
        data: {
          vehicleId,
          title: dto.title,
          date: new Date(dto.date),
          mileage: dto.mileage,
          timeMinutes: dto.timeMinutes,
          costAmount: dto.costAmount,
          status: dto.status ?? 'planned',
          executor: dto.executor ?? 'self',
          professionalName: dto.professionalName,
          notes: dto.notes,
        },
      });

      for (const usage of usages) {
        const item = itemById.get(usage.stockItemId)!;
        await tx.stockItem.update({
          where: { id: item.id },
          data: { quantity: { decrement: usage.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            ownerId,
            stockItemId: item.id,
            type: 'consume',
            quantity: usage.quantity,
            valueAmount: item.valueAmount
              ? Number(item.valueAmount) * usage.quantity
              : undefined,
            targetType: 'vehicle',
            targetId: vehicleId,
            interventionId: intervention.id,
            note: `Travail : ${dto.title}`,
          },
        });
      }

      return intervention;
    });
  }

  async addAlert(
    ownerId: string,
    vehicleId: string,
    dto: CreateVehicleAlertDto,
  ) {
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

  async updateAlert(
    ownerId: string,
    vehicleId: string,
    alertId: string,
    status: string,
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.ensureAlertBelongs(vehicleId, alertId);
    return this.prisma.vehicleAlert.update({
      where: { id: alertId },
      data: { status },
    });
  }

  async deleteAlert(ownerId: string, vehicleId: string, alertId: string) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.ensureAlertBelongs(vehicleId, alertId);
    await this.prisma.vehicleAlert.delete({ where: { id: alertId } });
  }

  async listParts(ownerId: string, vehicleId: string) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    return this.prisma.vehiclePart.findMany({
      where: { vehicleId },
      orderBy: [{ status: 'asc' }, { urgency: 'asc' }, { name: 'asc' }],
    });
  }

  async addPart(ownerId: string, vehicleId: string, dto: CreateVehiclePartDto) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    return this.prisma.vehiclePart.create({
      data: {
        vehicleId,
        name: dto.name,
        quantity: dto.quantity ?? 1,
        category: dto.category ?? 'autre',
        status: dto.status ?? 'a-acheter',
        urgency: dto.urgency ?? 'normal',
        priority: dto.priority ?? 'fiabilite',
        reference: dto.reference,
        dimension: dto.dimension,
        estimatedPrice: dto.estimatedPrice,
        realPrice: dto.realPrice,
        link: dto.link,
        comment: dto.comment,
      },
    });
  }

  async updatePart(
    ownerId: string,
    vehicleId: string,
    partId: string,
    dto: UpdateVehiclePartDto,
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.ensurePartBelongs(vehicleId, partId);
    return this.prisma.vehiclePart.update({
      where: { id: partId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.urgency !== undefined && { urgency: dto.urgency }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.reference !== undefined && { reference: dto.reference }),
        ...(dto.dimension !== undefined && { dimension: dto.dimension }),
        ...(dto.estimatedPrice !== undefined && {
          estimatedPrice: dto.estimatedPrice,
        }),
        ...(dto.realPrice !== undefined && { realPrice: dto.realPrice }),
        ...(dto.link !== undefined && { link: dto.link }),
        ...(dto.comment !== undefined && { comment: dto.comment }),
      },
    });
  }

  async deletePart(ownerId: string, vehicleId: string, partId: string) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.ensurePartBelongs(vehicleId, partId);
    await this.prisma.vehiclePart.delete({ where: { id: partId } });
  }

  async deleteVehicle(ownerId: string, id: string) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, id);
    await this.prisma.vehicle.delete({ where: { id } });
  }

  async updateIntervention(
    ownerId: string,
    vehicleId: string,
    interventionId: string,
    dto: {
      status: string;
      mileage?: number;
      executor?: string;
      professionalName?: string;
    },
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.ensureInterventionBelongs(vehicleId, interventionId);
    return this.prisma.vehicleIntervention.update({
      where: { id: interventionId },
      data: {
        status: dto.status,
        // V3 — mileage est posé seulement s'il est fourni (et non écrasé
        // par undefined) pour que la validation du travail puisse l'ajouter
        // sans toucher aux autres champs.
        ...(dto.mileage !== undefined && { mileage: dto.mileage }),
        ...(dto.executor !== undefined && { executor: dto.executor }),
        ...(dto.professionalName !== undefined && {
          professionalName: dto.professionalName,
        }),
      },
    });
  }

  async deleteIntervention(
    ownerId: string,
    vehicleId: string,
    interventionId: string,
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.ensureInterventionBelongs(vehicleId, interventionId);
    await this.prisma.vehicleIntervention.delete({
      where: { id: interventionId },
    });
  }

  /**
   * Auto-create CT / assurance alerts if dates are provided and no open alert exists yet.
   */
  private async autoCreateExpiryAlerts(
    vehicleId: string,
    insuranceExpiry: Date | null | undefined,
    ctExpiry: Date | null | undefined,
  ) {
    const pairs = [
      {
        type: 'insurance_expiry',
        title: 'Renouvellement assurance',
        date: insuranceExpiry,
      },
      { type: 'ct_expiry', title: 'Contrôle technique', date: ctExpiry },
    ] as const;

    for (const { type, title, date } of pairs) {
      if (!date) continue;
      const exists = await this.prisma.vehicleAlert.findFirst({
        where: { vehicleId, type, status: { not: 'resolved' } },
      });
      if (!exists) {
        await this.prisma.vehicleAlert.create({
          data: { vehicleId, type, title, dueDate: date, status: 'open' },
        });
      } else {
        // Sync dueDate if date changed
        await this.prisma.vehicleAlert.update({
          where: { id: exists.id },
          data: { dueDate: date },
        });
      }
    }
  }

  // Garde-fous d'isolation : une sous-ressource (alerte/pièce/intervention) ne
  // peut être modifiée/supprimée que si elle appartient bien au véhicule du
  // chemin — sinon un utilisateur possédant un véhicule pourrait, en
  // connaissant l'UUID cible, agir sur la sous-ressource d'un autre véhicule
  // (y compris d'un autre utilisateur). Cf. audit IDOR.
  private async ensureAlertBelongs(vehicleId: string, alertId: string) {
    const alert = await this.prisma.vehicleAlert.findFirst({
      where: { id: alertId, vehicleId },
      select: { id: true },
    });
    if (!alert) throw new NotFoundException('Alert not found');
  }

  private async ensurePartBelongs(vehicleId: string, partId: string) {
    const part = await this.prisma.vehiclePart.findFirst({
      where: { id: partId, vehicleId },
      select: { id: true },
    });
    if (!part) throw new NotFoundException('Part not found');
  }

  private async ensureInterventionBelongs(
    vehicleId: string,
    interventionId: string,
  ) {
    const intervention = await this.prisma.vehicleIntervention.findFirst({
      where: { id: interventionId, vehicleId },
      select: { id: true },
    });
    if (!intervention) throw new NotFoundException('Intervention not found');
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
