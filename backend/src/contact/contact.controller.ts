import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MailService } from '../mail/mail.service';
import { SendContactDto } from './dto/send-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly mail: MailService) {}

  /**
   * Endpoint PUBLIC (pas de JwtAuthGuard) consommé par la page Contact de
   * la landing. Throttled à 5 messages / 10 minutes par IP pour limiter
   * le spam, et on ne révèle pas si SMTP est configuré ou non (réponse
   * uniforme côté front).
   */
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post()
  @HttpCode(202)
  async send(@Body() dto: SendContactDto) {
    // Petit garde-fou anti-spam : refuse les liens en masse dans le body.
    const links = (dto.message.match(/https?:\/\//gi) ?? []).length;
    if (links > 5) {
      throw new BadRequestException('Trop de liens dans le message.');
    }

    const result = await this.mail.sendContactMessage({
      fromName: dto.name.trim(),
      fromEmail: dto.email.trim().toLowerCase(),
      subject: dto.subject.trim(),
      message: dto.message.trim(),
    });

    // 202 dans tous les cas pour ne pas révéler la configuration SMTP.
    // Le client n'a pas besoin de savoir si le mail est vraiment parti.
    return { accepted: true, delivered: result.sent };
  }
}
