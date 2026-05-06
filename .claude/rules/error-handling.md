---
paths:
  - "**/*.ts"
  - "**/*.js"
---

# Error Handling — Layered Exception Pattern (Node.js Backend)

## Hard rules (must)

- **Never lose the original stack**: always wrap errors using the native `{ cause }` option (V8/Node.js standard since v16.9).
- **Never mutate the original error**: wrap it in a new exception, don't modify it.
- **One error condition = exactly one log**: each exception that terminates an operation or business flow must produce a single log — no more, no less. The log level is determined by severity: `fatal` → ERROR, `recoverable` → WARN, `warning` → WARN.
- **Log only at the boundary**: the only places that should produce error/warn logs are Controllers (HTTP), SQS consumers, and ExceptionFilters/error middleware. Intermediate layers (services, repositories) throw — they do not log.
- **Classify every exception** with:
  - `code` — semantic string (e.g., `PAYMENT_PROVIDER_TIMEOUT`). Maintain a central enum/whitelist.
  - `severity` — `'fatal' | 'recoverable' | 'warning'` to drive flow decisions.
  - `retryable` — boolean to indicate if the operation can be retried.
  - `httpStatus` — HTTP status code for boundary responses (default: 500 for `fatal`, 400 for others). Override in domain exceptions (e.g., 422, 502, 409).
  - `meta` — frozen object with business context (IDs, parameters). Never PII.

## BaseException

```typescript
class BaseException extends Error {
  constructor(
    message: string,
    options: {
      cause?: Error;
      code?: string;
      severity?: "fatal" | "recoverable" | "warning";
      httpStatus?: number;
      retryable?: boolean;
      meta?: Record<string, unknown>;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code || "UNCLASSIFIED";
    this.severity = options.severity || "fatal";
    this.httpStatus =
      options.httpStatus ?? (this.severity === "fatal" ? 500 : 400);
    this.retryable = options.retryable ?? false;
    this.meta = Object.freeze(options.meta || {});
  }

  readonly code: string;
  readonly severity: "fatal" | "recoverable" | "warning";
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly meta: Readonly<Record<string, unknown>>;

  /** Returns the full chain of error messages. */
  getMessageChain(): string {
    const parts: string[] = [];
    let current: Error | undefined = this;
    while (current) {
      parts.push(`[${current.name}] ${current.message}`);
      current = current.cause as Error | undefined;
    }
    return parts.join(" <- ");
  }

  /** Serializes for structured logging (JSON). */
  toLogObject() {
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
```

## Layer subclasses

```typescript
class InfrastructureException extends BaseException {}
class RepositoryException extends BaseException {}
class ServiceException extends BaseException {}
class ControllerException extends BaseException {}
```

Domain-specific exceptions extend the appropriate layer class:

```typescript
class PaymentProviderTimeoutException extends ServiceException {
  constructor(
    providerName: string,
    timeoutMs: number,
    options: { cause?: Error } = {},
  ) {
    super(`Timeout invoking provider ${providerName} after ${timeoutMs}ms`, {
      ...options,
      code: "PAYMENT_PROVIDER_TIMEOUT",
      severity: "recoverable",
      httpStatus: 502,
      retryable: true,
      meta: { providerName, timeoutMs },
    });
  }
}
```

## Flow by layer

1. **Infrastructure** catches raw errors (ECONNRESET, ETIMEDOUT) → wraps in `InfrastructureException`.
2. **Repository** catches infrastructure errors → wraps in `RepositoryException` adding data context (table, query, IDs).
3. **Service** catches repo errors → decides:
   - Convert to a domain exception (e.g., `PaymentValidationException`).
   - Re-wrap as `ServiceException` if adding business context.
   - If no context to add, let it propagate without wrapping.
4. **Boundary** (Controller / SQS consumer / ExceptionFilter) inspects `severity` and `httpStatus`:
   - `fatal` → log ERROR + respond with `httpStatus` (default 500) or fail the message.
   - `recoverable` → log WARN + respond with `httpStatus` (e.g., 502, 422, 409) or retry.
   - `warning` → log WARN + respond with `httpStatus` (e.g., 200) or continue normally.

## Wiring: NestJS ExceptionFilter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof BaseException) {
      const logLevel = exception.severity === "fatal" ? "error" : "warn";
      logger[logLevel](exception.toLogObject());
      return response.status(exception.httpStatus).json({
        error: exception.code,
        message: exception.message,
      });
    }

    // Unclassified error — preserve original as cause
    const cause = exception instanceof Error ? exception : undefined;
    logger.error(new Error("Unhandled exception", { cause }));
    return response.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
```

## Wiring: Express error middleware

```typescript
function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof BaseException) {
    const logLevel = err.severity === "fatal" ? "error" : "warn";
    logger[logLevel](err.toLogObject());
    return res
      .status(err.httpStatus)
      .json({ error: err.code, message: err.message });
  }

  // Preserve original as cause
  logger.error(new Error("Unhandled exception", { cause: err }));
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}
```

## Wiring: SQS consumer boundary

SQS consumers are boundaries equivalent to controllers. Error handling in consumers:

```typescript
// Inside onMessage()
try {
  await this.executeListener(eventListener, message);
  await message.del(); // ack
} catch (error) {
  if (error instanceof BaseException) {
    const logLevel = error.severity === "fatal" ? "error" : "warn";
    logger[logLevel](error.toLogObject());

    if (error instanceof InconsistentMessageDataException) {
      await message.del(); // drop — data is unrecoverable
    } else {
      message.keep(); // retry
    }
  } else {
    const cause = error instanceof Error ? error : undefined;
    logger.error(new Error("Unclassified SQS error", { cause }));
    message.keep();
  }
}
```

## Forbidden patterns (must not)

- ❌ Logging the same error at multiple layers (e.g., log in service AND controller).
- ❌ Catching and re-throwing without adding context — either add context or let it propagate.
- ❌ Using `inspect()` to serialize errors — use `toLogObject()` for structured JSON.
- ❌ Swallowing exceptions silently (empty catch blocks).
- ❌ Throwing raw `Error` from business code — use `BaseException` subclasses.
- ❌ Putting PII in the `meta` field (emails, IDs, bank info, tokens).

## Review checks (look for)

- 🔴 `logger.error()` call inside a service or repository (should only be at boundary).
- 🔴 `new Error(...)` thrown from service/repository code (should be a `BaseException` subclass).
- 🔴 Exception caught and re-thrown without `{ cause }` — original stack will be lost.
- 🔴 Multiple logs (ERROR or WARN) for the same exception chain.
- 🔴 `inspect()` used to serialize an error into a log message.
- 🟡 `BaseException` thrown without a meaningful `code` (left as `UNCLASSIFIED`).
- 🟡 `meta` containing potentially sensitive data (review field names for PII risk).
- 🟡 Missing `severity` classification — defaults to `fatal`, which may not be correct.

> **Example**: see [examples/before-after-1.md](examples/before-after-1.md) — log-per-catch vs boundary-only.
