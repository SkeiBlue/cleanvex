import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import type { FileFilterCallback } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo

const ALLOWED_MIMES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  // Archives
  'application/zip', 'application/x-zip-compressed',
]);

function mimeFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException(`Type de fichier non autorisé : ${file.mimetype}`));
  }
}

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.documents.list(req.user.id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE }, fileFilter: mimeFilter }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('expiresAt') expiresAt: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documents.store(file, req.user.id, expiresAt);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.documents.delete(id, req.user.id);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const file = await this.documents.getDownload(id, req.user.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    return res.sendFile(file.absolutePath);
  }
}
