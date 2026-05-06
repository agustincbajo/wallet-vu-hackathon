import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { runWithTraceContext } from './logger';
import { buildTraceContext } from './trace-context';

@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const context = buildTraceContext(request.headers);
    response.setHeader('traceparent', `00-${context.traceId}-${context.spanId}-01`);
    runWithTraceContext(context, () => next());
  }
}
