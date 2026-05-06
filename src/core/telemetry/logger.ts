import { LoggerService, LogLevel } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TraceContext } from './trace-context';

const SERVICE_NAME = 'wallet_vu_hackathon';
const SERVICE_ENV = process.env.NODE_ENV ?? 'local';
const SERVICE_VERSION = process.env.SERVICE_VERSION ?? '0.1.0';
const SERVICE_TEAM = process.env.SERVICE_TEAM ?? 'wallet';

const traceStorage = new AsyncLocalStorage<TraceContext>();

export function runWithTraceContext<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn);
}

export function currentTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

type LogLevelName = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevelName;
  message: string;
  service: string;
  env: string;
  team: string;
  version: string;
  timestamp: string;
  trace_id?: string;
  span_id?: string;
  trace_state?: Record<string, string>;
  debug_mode?: boolean;
  [key: string]: unknown;
}

export class ModoLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.emit('info', message, context);
  }

  error(message: unknown, stackOrContext?: string, context?: string): void {
    this.emit('error', message, context ?? stackOrContext);
  }

  warn(message: unknown, context?: string): void {
    this.emit('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.emit('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.emit('debug', message, context);
  }

  setLogLevels(_levels: LogLevel[]): void {
    // no-op
  }

  private emit(level: LogLevelName, payload: unknown, context?: string): void {
    const trace = currentTraceContext();
    const entry: LogEntry = {
      level,
      message: typeof payload === 'string' ? payload : 'log',
      service: SERVICE_NAME,
      env: SERVICE_ENV,
      team: SERVICE_TEAM,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    };

    if (context) {
      entry['logger_context'] = context;
    }

    if (trace) {
      entry.trace_id = trace.traceId;
      entry.span_id = trace.spanId;
      if (trace.traceState) {
        entry.trace_state = trace.traceState;
      }
      if (trace.debugMode) {
        entry.debug_mode = true;
      }
    }

    if (payload && typeof payload === 'object') {
      Object.assign(entry, payload as Record<string, unknown>);
      const maybeMessage = (payload as { message?: unknown }).message;
      if (typeof maybeMessage === 'string') {
        entry.message = maybeMessage;
      }
    }

    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

export const logger = new ModoLogger();
