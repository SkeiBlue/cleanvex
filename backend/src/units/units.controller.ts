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
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.units.list(req.user.id);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateUnitDto) {
    return this.units.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.units.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.units.remove(req.user.id, id);
  }
}
