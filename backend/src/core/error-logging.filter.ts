import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@Catch()
export class ErrorLoggingFilter implements ExceptionFilter {
  constructor(private readonly prisma: PrismaService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.message(exception);

    if (status >= 500) {
      void this.prisma.errorLog
        .create({
          data: {
            level: 'error',
            message,
            contextJson: this.context(exception),
          },
        })
        .catch(() => undefined);
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'UNKNOWN',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private message(exception: unknown) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response && 'message' in response) {
        const message = response.message;
        return Array.isArray(message) ? message.join(', ') : String(message);
      }
      return exception.message;
    }

    if (exception instanceof Error) return exception.message;
    return 'Internal server error';
  }

  private context(exception: unknown) {
    if (exception instanceof Error) {
      return {
        name: exception.name,
        stack: exception.stack,
      };
    }

    return { exception: String(exception) };
  }
}
