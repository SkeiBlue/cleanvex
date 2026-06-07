import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { assertRequiredEnv } from './core/env.validation';

async function bootstrap() {
  assertRequiredEnv();
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
