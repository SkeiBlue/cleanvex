import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleCacheService } from '../core/module-cache.service';
import { paginate, PaginationDto } from '../core/pagination.helper';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdirSync, unlink } from 'fs';
import { writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsService {
  private readonly storageRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleCache: ModuleCacheService,
    config: ConfigService,
  ) {
    this.storageRoot = resolve(
      config.get<string>('PRIVATE_FILES_DIR', 'private-files'),
    );
    mkdirSync(this.storageRoot, { recursive: true });
  }

  async list(
    ownerId: string,
    { page = 1, limit = 50 }: PaginationDto = {},
    categoryId?: string,
  ) {
    await this.ensureDocumentsEnabled();
    const where: Record<string, unknown> = { ownerId };
    if (categoryId) where.categoryId = categoryId;
    const select = {
      id: true,
      name: true,
      type: true,
      visibility: true,
      mimeType: true,
      size: true,
      expiresAt: true,
      categoryId: true,
      createdAt: true,
    };
    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async listCategories() {
    await this.ensureDocumentsEnabled();
    return this.prisma.documentCategory.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async setCategory(ownerId: string, id: string, categoryId: string | null) {
    await this.ensureDocumentsEnabled();
    const document = await this.prisma.document.findFirst({
      where: { id, ownerId },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (categoryId) {
      const cat = await this.prisma.documentCategory.findUnique({
        where: { id: categoryId },
      });
      if (!cat) throw new BadRequestException('Catégorie inconnue');
    }
    return this.prisma.document.update({
      where: { id },
      data: { categoryId },
    });
  }

  async store(
    file: Express.Multer.File | undefined,
    ownerId: string,
    expiresAt?: string,
    sourceModule?: string,
    categoryId?: string,
  ) {
    await this.ensureDocumentsEnabled();

    if (!file) {
      throw new BadRequestException('Missing file');
    }

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const extension = extname(file.originalname);
    const storedName = `${randomUUID()}${extension}`;
    const absolutePath = join(this.storageRoot, storedName);
    await writeFile(absolutePath, file.buffer);
    const expirationDate = this.parseExpirationDate(expiresAt);
    const resolvedCategoryId = await this.resolveCategoryId(
      categoryId,
      sourceModule,
    );

    const document = await this.prisma.document.create({
      data: {
        ownerId,
        name: file.originalname,
        type: 'upload',
        visibility: 'private',
        storagePath: storedName,
        mimeType: file.mimetype,
        size: file.size,
        hash,
        expiresAt: expirationDate,
        categoryId: resolvedCategoryId,
      },
    });

    if (document.expiresAt) {
      await this.prisma.notification.create({
        data: {
          ownerId,
          type: 'document_expiration',
          title: `Expiration document - ${document.name}`,
          message: 'Un document arrive a expiration.',
          importance: 'high',
          dueDate: document.expiresAt,
          targetType: 'document',
          targetId: document.id,
        },
      });
    }

    return document;
  }

  async getDownload(id: string, ownerId: string) {
    await this.ensureDocumentsEnabled();

    const document = await this.prisma.document.findFirst({
      where: { id, ownerId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return {
      name: document.name,
      mimeType: document.mimeType,
      absolutePath: join(this.storageRoot, document.storagePath),
    };
  }

  async delete(id: string, ownerId: string) {
    await this.ensureDocumentsEnabled();
    const document = await this.prisma.document.findFirst({
      where: { id, ownerId },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.documentLink.deleteMany({ where: { documentId: id } });
    await this.prisma.document.delete({ where: { id } });

    const filePath = join(this.storageRoot, document.storagePath);
    unlink(filePath, () => {});
  }

  private ensureDocumentsEnabled(): Promise<void> {
    return this.moduleCache.assertEnabled('documents');
  }

  // Si un categoryId explicite est fourni → on l'utilise (après vérif d'existence).
  // Sinon on tente le slug du module source. Sinon "general".
  private async resolveCategoryId(
    categoryId?: string,
    sourceModule?: string,
  ): Promise<string | null> {
    if (categoryId) {
      const cat = await this.prisma.documentCategory.findUnique({
        where: { id: categoryId },
      });
      if (cat) return cat.id;
    }
    const slug = sourceModule ?? 'general';
    const auto = await this.prisma.documentCategory.findUnique({
      where: { slug },
    });
    if (auto) return auto.id;
    const fallback = await this.prisma.documentCategory.findUnique({
      where: { slug: 'general' },
    });
    return fallback ? fallback.id : null;
  }

  private parseExpirationDate(expiresAt?: string) {
    if (!expiresAt) return undefined;

    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid expiration date');
    }

    return date;
  }
}
