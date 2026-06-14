import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

// Unités par défaut globales, seedées au boot. userId = null.
const DEFAULT_UNITS: { label: string; symbol: string; type: string }[] = [
  { label: 'pièce', symbol: 'pcs', type: 'quantity' },
  { label: 'litre', symbol: 'L', type: 'volume' },
  { label: 'millilitre', symbol: 'mL', type: 'volume' },
  { label: 'kilogramme', symbol: 'kg', type: 'weight' },
  { label: 'gramme', symbol: 'g', type: 'weight' },
  { label: 'mètre', symbol: 'm', type: 'length' },
  { label: 'centimètre', symbol: 'cm', type: 'length' },
  { label: 'millimètre', symbol: 'mm', type: 'length' },
  { label: 'boîte', symbol: 'bte', type: 'quantity' },
  { label: 'carton', symbol: 'crt', type: 'quantity' },
  { label: 'rouleau', symbol: 'rlx', type: 'quantity' },
  { label: 'tube', symbol: 'tb', type: 'quantity' },
  { label: 'kit', symbol: 'kit', type: 'quantity' },
  { label: 'lot', symbol: 'lot', type: 'quantity' },
  { label: 'palette', symbol: 'pal', type: 'quantity' },
  { label: 'sac', symbol: 'sac', type: 'quantity' },
  { label: 'pot', symbol: 'pot', type: 'quantity' },
  { label: 'bidon', symbol: 'bid', type: 'quantity' },
  { label: 'bombe', symbol: 'bb', type: 'quantity' },
  { label: 'paquet', symbol: 'pq', type: 'quantity' },
  { label: 'bac', symbol: 'bac', type: 'quantity' },
  { label: 'jeu', symbol: 'jeu', type: 'quantity' },
  { label: 'set', symbol: 'set', type: 'quantity' },
];

@Injectable()
export class UnitsService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    // Seed des unités par défaut. Upsert sur (userId=null, label) — la
    // contrainte unique de Prisma `[userId, label]` accepte le NULL côté
    // Postgres mais Prisma ne sait pas l'utiliser comme @@unique partiel ;
    // on fait donc un findFirst + create pour idempotence.
    for (const u of DEFAULT_UNITS) {
      const existing = await this.prisma.unit.findFirst({
        where: { userId: null, label: u.label },
      });
      if (!existing) {
        await this.prisma.unit.create({
          data: {
            userId: null,
            label: u.label,
            symbol: u.symbol,
            type: u.type,
            isDefault: true,
            isActive: true,
          },
        });
      }
    }
  }

  async list(userId: string) {
    return this.prisma.unit.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
      },
      orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateUnitDto) {
    const label = dto.label.trim();
    if (!label) throw new ConflictException('Libellé requis');
    const existing = await this.prisma.unit.findFirst({
      where: {
        label,
        OR: [{ userId: null }, { userId }],
      },
    });
    if (existing) {
      throw new ConflictException('Une unité avec ce libellé existe déjà');
    }
    return this.prisma.unit.create({
      data: {
        userId,
        label,
        symbol: dto.symbol.trim() || label,
        type: dto.type ?? 'quantity',
        isDefault: false,
        isActive: true,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateUnitDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unité introuvable');
    // Les unités par défaut globales ne peuvent pas être modifiées par un user.
    if (unit.userId === null) {
      throw new ForbiddenException(
        'Les unités par défaut ne peuvent pas être modifiées',
      );
    }
    if (unit.userId !== userId) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.prisma.unit.update({
      where: { id },
      data: {
        label: dto.label?.trim() ?? unit.label,
        symbol: dto.symbol?.trim() ?? unit.symbol,
        type: dto.type ?? unit.type,
        isActive: dto.isActive ?? unit.isActive,
      },
    });
  }

  async remove(userId: string, id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unité introuvable');
    if (unit.userId === null) {
      throw new ForbiddenException(
        'Les unités par défaut ne peuvent pas être supprimées',
      );
    }
    if (unit.userId !== userId) {
      throw new ForbiddenException('Accès refusé');
    }
    // Si l'unité est utilisée par un article de stock, on refuse la suppression
    // et on suggère la désactivation (cf. règle métier S3 §10).
    const used = await this.prisma.stockItem.count({
      where: { ownerId: userId, unit: unit.label },
    });
    if (used > 0) {
      throw new ConflictException(
        `Unité utilisée par ${used} article(s). Désactivez-la plutôt que la supprimer.`,
      );
    }
    await this.prisma.unit.delete({ where: { id } });
    return { deleted: true };
  }
}
