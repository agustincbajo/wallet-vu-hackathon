import './core/telemetry';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ModoLogger, logger } from './core/telemetry';
import { GlobalExceptionFilter } from './infrastructure/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: new ModoLogger() });
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log({ message: 'application_started', port });
}

bootstrap();
