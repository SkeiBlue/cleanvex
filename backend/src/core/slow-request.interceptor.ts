import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

const DEFAULT_THRESHOLD_MS = 500;

@Injectable()
export class SlowRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SlowRequest');
  private readonly thresholdMs: number;

  constructor() {
    const fromEnv = Number(process.env.SLOW_REQUEST_THRESHOLD_MS);
    this.thresholdMs =
      Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_THRESHOLD_MS;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const start = Date.now();
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;
    const url = req.originalUrl ?? req.url;

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        if (durationMs >= this.thresholdMs) {
          this.logger.warn(`${method} ${url} ${durationMs}ms`);
        }
      }),
    );
  }
}
