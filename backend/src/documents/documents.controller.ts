import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import type { FileFilterCallback } from 'multer';
import { PaginationDto } from '../core/pagination.helper';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentsService } from './documents.service';

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo

// Pré-filtre grossier basé sur le mimetype *annoncé* par le client. NE constitue
// PAS la sécurité : il évite juste de bufferiser des types manifestement non
// supportés. La vraie validation (magic bytes + extension + blocage SVG) est
// faite après réception dans DocumentsService.store() via validateUpload().
const ALLOWED_MIMES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
]);

function mimeFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) {
  if (ALLOWED_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `Type de fichier non autorisé : ${file.mimetype}`,
      ),
    );
  }
}

/**
 * Construit un en-tête Content-Disposition sûr à partir d'un nom de fichier
 * fourni par l'utilisateur (ex: nom original à l'upload). On fournit un
 * fallback ASCII débarrassé des caractères qui casseraient le paramètre
 * (guillemets, antislash, contrôle) ainsi qu'une variante UTF-8 (RFC 6266).
 */
function contentDispositionHeader(filename: string): string {
  // eslint-disable-next-line no-control-regex -- on neutralise volontairement les caractères de contrôle
  const ascii = filename.replace(/[\x00-\x1f"\\]/g, '_');
  const utf8 = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationDto,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.documents.list(req.user.id, pagination, categoryId);
  }

  @Get('categories')
  categories() {
    return this.documents.listCategories();
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE },
      fileFilter: mimeFilter,
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documents.store(
      file,
      req.user.id,
      dto.expiresAt,
      dto.sourceModule,
      dto.categoryId,
    );
  }

  @Patch(':id/category')
  setCategory(
    @Param('id') id: string,
    @Body('categoryId') categoryId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documents.setCategory(req.user.id, id, categoryId ?? null);
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
    // Empêche le navigateur de "sniffer" et réinterpréter le contenu, et force
    // le téléchargement plutôt que l'affichage inline (défense en profondeur si
    // un fichier dangereux passait malgré la validation à l'upload).
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', contentDispositionHeader(file.name));
    return res.sendFile(file.absolutePath);
  }
}
