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
import { CreatePropertyEventDto } from './dto/create-property-event.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { LinkPropertyDocumentDto } from './dto/link-property-document.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { RealEstateService } from './real-estate.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('real-estate')
export class RealEstateController {
  constructor(private readonly realEstate: RealEstateService) {}

  @Get('properties')
  list(@Req() req: AuthenticatedRequest) {
    return this.realEstate.list(req.user.id);
  }

  @Post('properties')
  create(@Body() dto: CreatePropertyDto, @Req() req: AuthenticatedRequest) {
    return this.realEstate.create(req.user.id, dto);
  }

  @Get('properties/:id')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.realEstate.get(req.user.id, id);
  }

  @Patch('properties/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.update(req.user.id, id, dto);
  }

  @Delete('properties/:id')
  @HttpCode(204)
  delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.realEstate.delete(req.user.id, id);
  }

  @Post('properties/:id/events')
  addEvent(
    @Param('id') id: string,
    @Body() dto: CreatePropertyEventDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.addEvent(req.user.id, id, dto);
  }

  @Delete('properties/:id/events/:eventId')
  @HttpCode(204)
  deleteEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.deleteEvent(req.user.id, id, eventId);
  }

  @Post('properties/:id/documents')
  linkDocument(
    @Param('id') id: string,
    @Body() dto: LinkPropertyDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.realEstate.linkDocument(
      req.user.id,
      id,
      dto.documentId,
      dto.context,
    );
  }
}
