import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgendaService } from './agenda.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get('dashboard')
  dashboard(@Req() req: AuthenticatedRequest) {
    return this.agenda.dashboard(req.user.id);
  }

  @Get('tasks')
  tasks(@Req() req: AuthenticatedRequest) {
    return this.agenda.tasks(req.user.id);
  }

  @Post('tasks')
  createTask(@Req() req: AuthenticatedRequest, @Body() dto: CreateTaskDto) {
    return this.agenda.createTask(req.user.id, dto);
  }

  @Patch('tasks/:id')
  updateTask(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.agenda.updateTask(req.user.id, id, dto);
  }

  @Post('tasks/:id/subtasks')
  addSubtask(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.agenda.addSubtask(req.user.id, id, dto);
  }

  @Get('notifications')
  notifications(@Req() req: AuthenticatedRequest) {
    return this.agenda.notifications(req.user.id);
  }

  @Post('notifications')
  createNotification(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.agenda.createNotification(req.user.id, dto);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.agenda.markNotificationRead(req.user.id, id);
  }
}
