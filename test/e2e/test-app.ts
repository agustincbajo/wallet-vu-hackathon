import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { ModoLogger } from '../../src/core/telemetry';
import { GlobalExceptionFilter } from '../../src/infrastructure/filters/global-exception.filter';

export async function createTestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: new ModoLogger() });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return app;
}
