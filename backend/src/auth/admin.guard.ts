import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<{ user?: { id: string; role: string } }>();
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Réservé aux administrateurs.');
    }
    // Lot 5 §5 : les routes admin sont sensibles. On ne se base pas uniquement
    // sur le rôle présent dans le JWT (valide jusqu'à 15 min) : on revérifie en
    // base que le compte existe encore, est actif, et est toujours admin.
    const current = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isActive: true, role: true },
    });
    if (!current || !current.isActive || current.role !== 'admin') {
      throw new ForbiddenException('Réservé aux administrateurs.');
    }
    return true;
  }
}
