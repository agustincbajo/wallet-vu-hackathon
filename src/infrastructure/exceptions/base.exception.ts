export type ExceptionSeverity = 'fatal' | 'recoverable' | 'warning';

export interface BaseExceptionOptions {
  cause?: Error;
  code?: string;
  severity?: ExceptionSeverity;
  httpStatus?: number;
  retryable?: boolean;
  meta?: Record<string, unknown>;
}

export class BaseException extends Error {
  readonly code: string;
  readonly severity: ExceptionSeverity;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly meta: Readonly<Record<string, unknown>>;

  constructor(message: string, options: BaseExceptionOptions = {}) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code ?? 'UNCLASSIFIED';
    this.severity = options.severity ?? 'fatal';
    this.httpStatus = options.httpStatus ?? (this.severity === 'fatal' ? 500 : 400);
    this.retryable = options.retryable ?? false;
    this.meta = Object.freeze({ ...(options.meta ?? {}) });
  }

  getMessageChain(): string {
    const parts: string[] = [`[${this.name}] ${this.message}`];
    let current: unknown = this.cause;
    while (current instanceof Error) {
      parts.push(`[${current.name}] ${current.message}`);
      current = current.cause;
    }
    return parts.join(' <- ');
  }

  toLogObject(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      severity: this.severity,
      http_status: this.httpStatus,
      retryable: this.retryable,
      message_chain: this.getMessageChain(),
      meta: this.meta,
      stack: this.stack,
      cause_stack: this.cause instanceof Error ? this.cause.stack : undefined,
    };
  }
}
