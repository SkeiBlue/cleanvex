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
import { UpdateInterventionDto } from './dto/update-intervention.dto';
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
        interventions: {
          orderBy: { date: 'desc' },
          include: {
            professionalContact: {
              select: { id: true, displayName: true, organization: true },
            },
          },
        },
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

    // Lot A — pièces jointes + dépense Finances rattachées à chaque travail.
    const interventionIds = vehicle.interventions.map((i) => i.id);
    const [interventionDocLinks, interventionTxs] =
      interventionIds.length > 0
        ? await Promise.all([
            this.prisma.documentLink.findMany({
              where: {
                targetType: 'intervention',
                targetId: { in: interventionIds },
              },
              include: {
                document: {
                  select: {
                    id: true,
                    name: true,
                    mimeType: true,
                    createdAt: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            }),
            this.prisma.financialTransaction.findMany({
              where: {
                ownerId,
                sourceModule: 'vehicles',
                sourceType: 'intervention',
                sourceId: { in: interventionIds },
              },
              select: { id: true, sourceId: true, amount: true },
            }),
          ])
        : [[], []];

    const interventions = vehicle.interventions.map((interv) => ({
      ...interv,
      documents: interventionDocLinks.filter((l) => l.targetId === interv.id),
      financeTransaction:
        interventionTxs.find((t) => t.sourceId === interv.id) ?? null,
    }));

    return { ...vehicle, interventions, documents, stockMovements };
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

    // S2 — pièces du stock à consommer · Lot A — dépense en Finances.
    // Tout est fait dans une seule transaction Prisma : intervention +
    // décrément stock + mouvements + transaction financière (rollback
    // complet si une étape échoue).
    const usages = dto.stockUsages ?? [];

    // Pré-validation stock (hors transaction → erreur 400 propre).
    const itemIds = Array.from(new Set(usages.map((u) => u.stockItemId)));
    const items =
      itemIds.length > 0
        ? await this.prisma.stockItem.findMany({
            where: { id: { in: itemIds }, ownerId },
          })
        : [];
    const itemById = new Map(items.map((i) => [i.id, i] as const));
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

    // Sprint 2 — vérifie l'appartenance du contact pro si fourni.
    if (dto.professionalContactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.professionalContactId, ownerId },
        select: { id: true },
      });
      if (!contact) throw new NotFoundException('Contact pro introuvable.');
    }

    // Pré-validation finance (dégradable : ignorée si module Finances off).
    const wantFinance =
      !!dto.recordInFinance && !!dto.costAmount && dto.costAmount > 0;
    const financeOk = wantFinance && (await this.isFinancesEnabled());
    if (financeOk) {
      if (!dto.financeAccountId) {
        throw new BadRequestException(
          'Compte requis pour enregistrer la dépense en Finances.',
        );
      }
      const account = await this.prisma.financialAccount.findFirst({
        where: { id: dto.financeAccountId, ownerId },
        select: { id: true },
      });
      if (!account)
        throw new NotFoundException('Compte financier introuvable.');
      if (dto.financeCategoryId) {
        const cat = await this.prisma.financialCategory.findFirst({
          where: { id: dto.financeCategoryId, ownerId },
          select: { id: true },
        });
        if (!cat)
          throw new NotFoundException('Catégorie financière introuvable.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const intervention = await tx.vehicleIntervention.create({
        data: this.interventionData(vehicleId, dto),
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

      if (financeOk) {
        // CDC 16.1 — la dépense garde sa source (source_module=vehicles).
        await tx.financialTransaction.create({
          data: {
            ownerId,
            type: 'expense',
            amount: dto.costAmount!,
            accountId: dto.financeAccountId!,
            categoryId: dto.financeCategoryId,
            operationDate: new Date(dto.date),
            label: `Véhicule — ${dto.title}`,
            note: dto.notes,
            sourceModule: 'vehicles',
            sourceType: 'intervention',
            sourceId: intervention.id,
            status: 'linked',
          },
        });
      }

      return intervention;
    });
  }

  /** Construit les données communes d'une intervention (création). */
  private interventionData(vehicleId: string, dto: CreateInterventionDto) {
    return {
      vehicleId,
      title: dto.title,
      date: new Date(dto.date),
      mileage: dto.mileage,
      timeMinutes: dto.timeMinutes,
      costAmount: dto.costAmount,
      status: dto.status ?? 'planned',
      executor: dto.executor ?? 'self',
      professionalName: dto.professionalName,
      professionalContactId: dto.professionalContactId || null,
      notes: dto.notes,
      category: dto.category,
      warrantyUntil: dto.warrantyUntil
        ? new Date(dto.warrantyUntil)
        : undefined,
      warrantyMileage: dto.warrantyMileage,
      nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : undefined,
      nextDueMileage: dto.nextDueMileage,
    };
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

  // Lot B — crée une tâche Agenda depuis une alerte/échéance véhicule.
  // Dégradable : 403 si le module Agenda est désactivé. Idempotent : ne
  // recrée pas de tâche si une tâche active existe déjà pour cette alerte
  // (targetType=vehicle_alert) → la tâche remonte dans l'agenda + rappels.
  async createTaskFromAlert(
    ownerId: string,
    vehicleId: string,
    alertId: string,
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.ensureAlertBelongs(vehicleId, alertId);
    if (!(await this.isAgendaEnabled())) {
      throw new ForbiddenException('Module Agenda désactivé.');
    }
    const alert = await this.prisma.vehicleAlert.findUniqueOrThrow({
      where: { id: alertId },
    });
    const vehicle = await this.prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicleId },
      select: { name: true },
    });
    const existing = await this.prisma.task.findFirst({
      where: {
        ownerId,
        targetType: 'vehicle_alert',
        targetId: alertId,
        status: { not: 'done' },
      },
    });
    if (existing) return { task: existing, alreadyExists: true };
    const task = await this.prisma.task.create({
      data: {
        ownerId,
        title: `${vehicle.name} — ${alert.title}`,
        dueDate: alert.dueDate ?? undefined,
        moduleKey: 'vehicles',
        targetType: 'vehicle_alert',
        targetId: alertId,
        priority: 'high',
      },
    });
    return { task, alreadyExists: false };
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

  // Lot A — édition complète d'une intervention (le même endpoint sert
  // aussi au simple changement de statut : tous les champs sont optionnels).
  async updateIntervention(
    ownerId: string,
    vehicleId: string,
    interventionId: string,
    dto: UpdateInterventionDto,
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.ensureInterventionBelongs(vehicleId, interventionId);
    // Sprint 2 — vérifie le contact si on en assigne un.
    if (dto.professionalContactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.professionalContactId, ownerId },
        select: { id: true },
      });
      if (!contact) throw new NotFoundException('Contact pro introuvable.');
    }
    return this.prisma.vehicleIntervention.update({
      where: { id: interventionId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.mileage !== undefined && { mileage: dto.mileage }),
        ...(dto.timeMinutes !== undefined && { timeMinutes: dto.timeMinutes }),
        ...(dto.costAmount !== undefined && { costAmount: dto.costAmount }),
        ...(dto.executor !== undefined && { executor: dto.executor }),
        ...(dto.professionalName !== undefined && {
          professionalName: dto.professionalName,
        }),
        ...(dto.professionalContactId !== undefined && {
          professionalContactId: dto.professionalContactId || null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.warrantyUntil !== undefined && {
          warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null,
        }),
        ...(dto.warrantyMileage !== undefined && {
          warrantyMileage: dto.warrantyMileage,
        }),
        ...(dto.nextDueDate !== undefined && {
          nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
        }),
        ...(dto.nextDueMileage !== undefined && {
          nextDueMileage: dto.nextDueMileage,
        }),
      },
    });
  }

  // Lien pièce jointe (facture/photo) → intervention (réutilise document_links).
  async linkInterventionDocument(
    ownerId: string,
    vehicleId: string,
    interventionId: string,
    documentId: string,
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    await this.ensureInterventionBelongs(vehicleId, interventionId);
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, ownerId },
      select: { id: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    return this.prisma.documentLink.create({
      data: {
        documentId,
        targetType: 'intervention',
        targetId: interventionId,
        context: 'intervention',
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
    // CDC 16.3 — on ne supprime pas la dépense liée : on la détache
    // (conserve l'historique financier), on retire juste le lien source.
    await this.prisma.financialTransaction.updateMany({
      where: {
        ownerId,
        sourceModule: 'vehicles',
        sourceType: 'intervention',
        sourceId: interventionId,
      },
      data: {
        sourceModule: null,
        sourceType: null,
        sourceId: null,
        status: 'manual',
      },
    });
    // Les StockMovement liés ont onDelete:SetNull → l'historique reste,
    // seul le lien interventionId est nullé automatiquement.
    await this.prisma.vehicleIntervention.delete({
      where: { id: interventionId },
    });
  }

  // Lot C — annule une sortie de stock imputée à ce véhicule (remet la
  // quantité en stock + supprime le mouvement). Sécurisé : seul un mouvement
  // de type 'consume' appartenant au user ET ciblant ce véhicule est annulable.
  async reverseStockMovement(
    ownerId: string,
    vehicleId: string,
    movementId: string,
  ) {
    await this.ensureVehiclesEnabled();
    await this.ensureVehicleExists(ownerId, vehicleId);
    const movement = await this.prisma.stockMovement.findFirst({
      where: {
        id: movementId,
        ownerId,
        targetType: 'vehicle',
        targetId: vehicleId,
      },
    });
    if (!movement) throw new NotFoundException('Mouvement introuvable.');
    if (movement.type !== 'consume') {
      throw new BadRequestException(
        'Seules les sorties (consommations) peuvent être annulées.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.stockItem.update({
        where: { id: movement.stockItemId },
        data: { quantity: { increment: movement.quantity } },
      });
      await tx.stockMovement.delete({ where: { id: movementId } });
      return { restored: true };
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

  // Lot A — le lien Finances est optionnel/dégradable : si le module est
  // désactivé, on n'écrit simplement rien côté Finances (pas d'erreur).
  private async isFinancesEnabled(): Promise<boolean> {
    const module = await this.prisma.module.findUnique({
      where: { key: 'finances' },
    });
    return !module || module.isEnabled;
  }

  // Lot B — même principe pour l'Agenda.
  private async isAgendaEnabled(): Promise<boolean> {
    const module = await this.prisma.module.findUnique({
      where: { key: 'agenda' },
    });
    return !module || module.isEnabled;
  }
}
