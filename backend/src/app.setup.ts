import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

export function setupApp(app: INestApplication) {
  const allowedOrigins = (
    process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((origin) => origin.trim());

  // Derrière Nginx (un seul reverse-proxy), on fait confiance au premier hop
  // pour récupérer l'IP réelle du client (X-Forwarded-For) : rate-limit, logs
  // d'audit et page Sessions s'appuient dessus. Ajuster la valeur si plusieurs
  // proxies sont chaînés.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  return app;
}
