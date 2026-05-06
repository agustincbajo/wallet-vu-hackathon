import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { logger } from '../../core/telemetry';
import { BaseException } from '../exceptions';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof BaseException) {
      const level = exception.severity === 'fatal' ? 'error' : 'warn';
      logger[level](exception.toLogObject());
      response.status(exception.httpStatus).json({
        error: exception.code,
        message: exception.message,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const level = status >= 500 ? 'error' : 'warn';
      const body = exception.getResponse();
      logger[level]({
        message: 'http_exception',
        http_status: status,
        body,
        stack: exception.stack,
      });
      response.status(status).json(typeof body === 'string' ? { message: body } : body);
      return;
    }

    const cause = exception instanceof Error ? exception : undefined;
    const wrapped = new Error('Unhandled exception', { cause });
    logger.error({
      message: 'unhandled_exception',
      stack: wrapped.stack,
      cause_stack: cause?.stack,
      cause_message: cause?.message,
    });
    response.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
