import { logger } from './logger';

process.on('uncaughtException', (error: Error) => {
  logger.error({ message: 'uncaught_exception', error: serializeError(error) });
});

process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof Error) {
    logger.error({ message: 'unhandled_rejection', error: serializeError(reason) });
  } else {
    logger.error({ message: 'unhandled_rejection', reason });
  }
});

function serializeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause instanceof Error ? error.cause.message : undefined,
  };
}

export { logger, runWithTraceContext, currentTraceContext, ModoLogger } from './logger';
export { buildTraceContext } from './trace-context';
export type { TraceContext } from './trace-context';
