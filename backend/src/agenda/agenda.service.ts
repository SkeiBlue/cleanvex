import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(ownerId: string) {
    await this.ensureAgendaEnabled();
    const now = new Date();
    const [openTasks, overdueTasks, unreadNotifications, upcomingTasks] =
      await Promise.all([
        this.prisma.task.count({ where: { ownerId, status: { not: 'done' } } }),
        this.prisma.task.count({
          where: { ownerId, status: { not: 'done' }, dueDate: { lt: now } },
        }),
        this.prisma.notification.count({ where: { ownerId, isRead: false } }),
        this.prisma.task.findMany({
          where: { ownerId, status: { not: 'done' }, dueDate: { not: null } },
          orderBy: { dueDate: 'asc' },
          take: 5,
        }),
      ]);

    return { openTasks, overdueTasks, unreadNotifications, upcomingTasks };
  }

  async tasks(ownerId: string) {
    await this.ensureAgendaEnabled();
    return this.prisma.task.findMany({
      where: { ownerId },
      include: { subtasks: { orderBy: { position: 'asc' } } },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  async createTask(ownerId: string, dto: CreateTaskDto) {
    await this.ensureAgendaEnabled();
    const task = await this.prisma.task.create({
      data: {
        ownerId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'normal',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        moduleKey: dto.moduleKey,
        targetType: dto.targetType,
        targetId: dto.targetId,
        progress: dto.progress ?? 0,
      },
      include: { subtasks: true },
    });

    if (task.dueDate) {
      await this.createNotification(ownerId, {
        type: 'task_due',
        title: `Echeance - ${task.title}`,
        message: task.description ?? undefined,
        importance: task.priority,
        dueDate: task.dueDate.toISOString(),
        targetType: 'task',
        targetId: task.id,
      });
    }

    return task;
  }

  async updateTask(ownerId: string, id: string, dto: UpdateTaskDto) {
    await this.ensureAgendaEnabled();
    await this.ensureOwnedTask(ownerId, id);
    return this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: { subtasks: { orderBy: { position: 'asc' } } },
    });
  }

  async addSubtask(ownerId: string, taskId: string, dto: CreateSubtaskDto) {
    await this.ensureAgendaEnabled();
    await this.ensureOwnedTask(ownerId, taskId);
    return this.prisma.subtask.create({
      data: {
        taskId,
        title: dto.title,
        isDone: dto.isDone ?? false,
        position: dto.position ?? 0,
      },
    });
  }

  async notifications(ownerId: string) {
    await this.ensureAgendaEnabled();
    return this.prisma.notification.findMany({
      where: { ownerId },
      orderBy: [{ isRead: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createNotification(ownerId: string, dto: CreateNotificationDto) {
    await this.ensureAgendaEnabled();
    return this.prisma.notification.create({
      data: {
        ownerId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        importance: dto.importance ?? 'normal',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        targetType: dto.targetType,
        targetId: dto.targetId,
      },
    });
  }

  async markNotificationRead(ownerId: string, id: string) {
    await this.ensureAgendaEnabled();
    const notification = await this.prisma.notification.findFirst({
      where: { id, ownerId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async deleteNotification(ownerId: string, id: string) {
    await this.ensureAgendaEnabled();
    const notification = await this.prisma.notification.findFirst({ where: { id, ownerId } });
    if (!notification) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true };
  }

  async deleteTask(ownerId: string, id: string) {
    await this.ensureAgendaEnabled();
    await this.ensureOwnedTask(ownerId, id);
    await this.prisma.task.delete({ where: { id } });
    return { deleted: true };
  }

  async deleteInteractionByContact(ownerId: string, interactionId: string) {
    // interactions n'ont pas d'ownerId direct, on vérifie via le contact
    const interaction = await this.prisma.contactInteraction.findFirst({
      where: { id: interactionId, contact: { ownerId } },
    });
    if (!interaction) throw new NotFoundException('Interaction not found');
    await this.prisma.contactInteraction.delete({ where: { id: interactionId } });
    return { deleted: true };
  }

  private async ensureOwnedTask(ownerId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, ownerId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async ensureAgendaEnabled() {
    const module = await this.prisma.module.findUnique({
      where: { key: 'agenda' },
    });
    if (module && !module.isEnabled) {
      throw new ForbiddenException('Agenda module is disabled');
    }
  }
}
