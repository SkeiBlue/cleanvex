import { BadRequestException } from '@nestjs/common';
import FileType from 'file-type';
import { extname } from 'path';

/**
 * Validation réelle des fichiers uploadés.
 *
 * On ne fait PAS confiance au `mimetype` annoncé par le client (header
 * multipart, falsifiable). On détecte le vrai type via les *magic bytes*
 * (lib `file-type`) et on exige que l'extension du nom d'origine corresponde
 * au type réellement détecté.
 */

const SVG_ERROR =
  "Le format SVG n'est pas autorisé pour des raisons de sécurité.";

/**
 * Types réellement détectables par magic bytes → extensions acceptées.
 * La clé est le `mime` retourné par `file-type`, la valeur la liste des
 * extensions cohérentes avec ce type.
 */
const DETECTABLE_ALLOWED: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'docx',
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/zip': ['zip'],
};

/**
 * Types texte sans magic bytes fiables (`file-type` renvoie `undefined`).
 * On les autorise uniquement sur la base de l'extension + contrôle du contenu.
 */
const TEXT_ALLOWED: Record<string, string> = {
  txt: 'text/plain',
  csv: 'text/csv',
};

function fileExtension(name: string): string {
  return extname(name).replace(/^\./, '').toLowerCase();
}

/** Détection défensive d'un contenu SVG/XML/HTML déguisé. */
function looksLikeSvgOrMarkup(buffer: Buffer): boolean {
  // On regarde le début du fichier (en sautant BOM et espaces) à la recherche
  // d'une balise <svg ...> ou d'une déclaration XML/DOCTYPE menant à du SVG.
  const head = buffer.subarray(0, 1024).toString('utf8').toLowerCase();
  const trimmed = head.replace(/^￯|^﻿/, '').trimStart();
  return (
    trimmed.includes('<svg') ||
    trimmed.includes('<!doctype svg') ||
    trimmed.startsWith('<?xml') // un .svg commence souvent par <?xml ...?>
  );
}

/** Contrôle qu'un fichier "texte" est bien du texte (pas un binaire déguisé). */
function looksLikeText(buffer: Buffer): boolean {
  // Présence d'octets NUL → binaire, pas du texte.
  return !buffer.subarray(0, 4096).includes(0);
}

export interface ValidatedUpload {
  /** Mime réel retenu après validation (à stocker, plutôt que le mime client). */
  mime: string;
}

export async function validateUpload(
  file: Express.Multer.File | undefined,
): Promise<ValidatedUpload> {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Missing file');
  }

  const ext = fileExtension(file.originalname);

  // 1) SVG bloqué quel que soit le déguisement : extension, mime annoncé,
  //    ou contenu détecté.
  if (
    ext === 'svg' ||
    file.mimetype === 'image/svg+xml' ||
    looksLikeSvgOrMarkup(file.buffer)
  ) {
    throw new BadRequestException(SVG_ERROR);
  }

  // 2) Détection par magic bytes.
  const detected = await FileType.fromBuffer(file.buffer);

  if (detected) {
    const allowedExts = DETECTABLE_ALLOWED[detected.mime];
    if (!allowedExts) {
      throw new BadRequestException(
        `Type de fichier non autorisé : ${detected.mime}`,
      );
    }
    // L'extension doit correspondre au type réel (ex: .exe renommé .png refusé).
    if (!allowedExts.includes(ext)) {
      throw new BadRequestException(
        `L'extension « .${ext} » ne correspond pas au contenu réel du fichier.`,
      );
    }
    return { mime: detected.mime };
  }

  // 3) Pas de magic bytes → seuls les formats texte connus sont tolérés,
  //    et uniquement si le contenu est réellement du texte.
  const textMime = TEXT_ALLOWED[ext];
  if (textMime && looksLikeText(file.buffer)) {
    return { mime: textMime };
  }

  throw new BadRequestException(
    'Type de fichier inconnu ou non autorisé.',
  );
}
