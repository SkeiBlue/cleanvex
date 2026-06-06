import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactsService } from './contacts.service';
import { CreateContactInteractionDto } from './dto/create-contact-interaction.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { LinkContactDocumentDto } from './dto/link-contact-document.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.contacts.list(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateContactDto, @Req() req: AuthenticatedRequest) {
    return this.contacts.create(req.user.id, dto);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.contacts.get(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contacts.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.contacts.delete(req.user.id, id);
  }

  @Post(':id/interactions')
  addInteraction(
    @Param('id') id: string,
    @Body() dto: CreateContactInteractionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contacts.addInteraction(req.user.id, id, dto);
  }

  @Delete(':id/interactions/:interactionId')
  @HttpCode(204)
  deleteInteraction(
    @Param('id') id: string,
    @Param('interactionId') interactionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contacts.deleteInteraction(req.user.id, id, interactionId);
  }

  @Post(':id/documents')
  linkDocument(
    @Param('id') id: string,
    @Body() dto: LinkContactDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contacts.linkDocument(req.user.id, id, dto.documentId, dto.context);
  }
}
