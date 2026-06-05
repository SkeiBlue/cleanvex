import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    config: ConfigService,
  ) {
    this.storageRoot = resolve(config.get<string>('PRIVATE_FILES_DIR', 'private-files'));
    mkdirSync(this.storageRoot, { recursive: true });
  }

  async list(ownerId: string) {
    await this.ensureDocumentsEnabled();
    return this.prisma.document.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        visibility: true,
        mimeType: true,
        size: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async store(
    file: Express.Multer.File | undefined,
    ownerId: string,
    expiresAt?: string,
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
    const document = await this.prisma.document.findFirst({ where: { id, ownerId } });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.documentLink.deleteMany({ where: { documentId: id } });
    await this.prisma.document.delete({ where: { id } });

    const filePath = join(this.storageRoot, document.storagePath);
    unlink(filePath, () => {});
  }

  private async ensureDocumentsEnabled() {
    const module = await this.prisma.module.findUnique({
      where: { key: 'documents' },
    });

    if (module && !module.isEnabled) {
      throw new ForbiddenException('Documents module is disabled');
    }
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
