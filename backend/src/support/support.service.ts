import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddMessageDto } from './dto/add-message.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

const AUTHOR_SELECT = {
  select: { id: true, email: true, username: true, role: true },
} as const;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  // Liste des tickets de l'utilisateur courant.
  listMine(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  // Vue admin : tous les tickets, filtrables par statut.
  listAll(status?: string) {
    return this.prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
        user: AUTHOR_SELECT,
      },
    });
  }

  async create(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject.trim(),
        category: dto.category ?? 'general',
        priority: dto.priority ?? 'normal',
        status: 'open',
        messages: {
          create: {
            authorId: userId,
            body: dto.body.trim(),
            isStaff: false,
          },
        },
      },
      include: { _count: { select: { messages: true } } },
    });
  }

  // Récupère un ticket avec son fil. L'utilisateur ne voit que les siens ;
  // l'admin voit tout.
  async get(userId: string, isAdmin: boolean, id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: AUTHOR_SELECT,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: AUTHOR_SELECT },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable.');
    if (!isAdmin && ticket.userId !== userId) {
      throw new ForbiddenException('Accès refusé à ce ticket.');
    }
    return ticket;
  }

  async addMessage(
    userId: string,
    isAdmin: boolean,
    id: string,
    dto: AddMessageDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable.');
    if (!isAdmin && ticket.userId !== userId) {
      throw new ForbiddenException('Accès refusé à ce ticket.');
    }
    if (ticket.status === 'closed') {
      throw new ForbiddenException('Ce ticket est clôturé.');
    }

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId: id,
        authorId: userId,
        body: dto.body.trim(),
        isStaff: isAdmin,
      },
      include: { author: AUTHOR_SELECT },
    });

    // Une réponse admin passe le ticket en "pending" (attente du demandeur),
    // une réponse du demandeur le rouvre en "open".
    await this.prisma.supportTicket.update({
      where: { id },
      data: { status: isAdmin ? 'pending' : 'open', updatedAt: new Date() },
    });

    return message;
  }

  // Réservé admin : changement de statut / priorité.
  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable.');

    const closing = dto.status === 'closed' && ticket.status !== 'closed';
    const reopening = dto.status && dto.status !== 'closed';

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        priority: dto.priority,
        closedAt: closing ? new Date() : reopening ? null : undefined,
      },
    });
  }
}
