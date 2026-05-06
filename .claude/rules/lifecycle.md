---
paths:
  - "**/*.ts"
  - "**/*.js"
---
# Application Lifecycle — Bootstrap, Shutdown & Health (Node.js Backend)

## Hard rules (must)

- **Telemetry initializes first**: the telemetry module (`import './core/telemetry'`) MUST be the first import in `main.ts`, before `NestFactory.create()` or any application code. This ensures all traces and logs are captured from the start.
- **Graceful shutdown is mandatory**: all long-lived connections (DB, Redis, SQS, SES, etc.) MUST be closed cleanly on process termination.
- **Every provider holding a connection** MUST implement `OnApplicationShutdown`.
- **Unhandled errors are logged, never silenced**.
- **Entrypoint uses `exec`**: the Docker entrypoint MUST use `exec npm start` (or `exec node dist/main.js`) so that SIGTERM from Kubernetes reaches the Node.js process directly — not absorbed by a shell wrapper.

---

## Bootstrap order (must)

```typescript
// 1. Telemetry FIRST — before anything else
import './core/telemetry';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // 2. Create application
  const app = await NestFactory.create(AppModule, {
    logger: new ModoLogger(),
  });

  // 3. Enable shutdown hooks (NestJS propagates SIGTERM/SIGINT to providers)
  app.enableShutdownHooks();

  // 4. Global middleware, pipes, interceptors, filters
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 5. Connect SQS microservices (if applicable)
  for (const Strategy of sqsStrategies) {
    const instance = app.get(Strategy);
    app.connectMicroservice({ strategy: instance });
  }

  // 6. Start HTTP server
  await app.listen(process.env.PORT, '0.0.0.0');

  // 7. Start all microservices (SQS consumers)
  await app.startAllMicroservices();
}

bootstrap();
```

## Conditional consumers (should)

SQS consumers MAY be conditionally enabled via environment variables:

```typescript
const strategies = [SQSPaymentConsumerStrategy, SQSCashbackConsumerStrategy];

if (process.env.SQS_DELAYED_PAYMENT_FLAG === 'true') {
  strategies.push(SQSDelayedPaymentConsumerStrategy);
}
```

---

## Graceful shutdown (must)

### NestJS shutdown hooks

- `app.enableShutdownHooks()` makes NestJS call `onApplicationShutdown()` on all providers when the process receives SIGTERM/SIGINT.
- Every provider that holds a connection MUST implement `OnApplicationShutdown`:

```typescript
@Injectable()
export class SQSConsumerStrategy extends Server implements CustomTransportStrategy, OnApplicationShutdown {
  private isShuttingDown = false;

  async onApplicationShutdown() {
    this.isShuttingDown = true;
    await this.squiss.stop(true); // drain in-flight messages
  }
}
```

### All providers with connections (must)

Every provider that holds a long-lived connection MUST implement `OnApplicationShutdown`:

```typescript
// Redis cache
@Injectable()
export class CacheService implements OnApplicationShutdown {
  onApplicationShutdown() {
    logger.warn('closing Redis connection');
    this.cache.disconnect();
  }
}

// SES client
@Injectable()
export class SesService implements OnApplicationShutdown {
  onApplicationShutdown() {
    logger.warn('closing SES');
    this.sesClient.destroy();
  }
}

// DB (Knex) — when not using TypeORM's built-in shutdown
process.on('SIGTERM', async () => {
  logger.warn('closing Knex connection');
  await knex.destroy();
});
```

### SQS shutdown specifics

- Set `isShuttingDown = true` BEFORE calling `squiss.stop()`.
- The `isShuttingDown` flag prevents the error handler from attempting to reconnect during shutdown.
- `squiss.stop(true)` waits for in-flight messages to complete before stopping.

### Kubernetes / Istio layer (must)

Graceful shutdown requires coordination between the application and Kubernetes:

- **Istio sidecar drain**: configure `terminationDrainDuration` in pod annotations so the Istio proxy drains active connections before terminating:
  ```yaml
  # helm/values.yaml
  podAnnotations:
    proxy.istio.io/config: |
      terminationDrainDuration: 30s
  ```
- **Liveness probe**: HTTP GET `/health` — verifies the process is alive.
- **Readiness probe**: HTTP GET `/readiness` — verifies the service can accept traffic. Use a higher `initialDelaySeconds` than liveness to allow startup time.
- **Entrypoint**: use `exec` to replace the shell process so SIGTERM goes directly to Node:
  ```bash
  # entrypoint.sh
  exec npm start
  ```

### Process-level signal handlers

```typescript
process.on('uncaughtException', (error: Error) => {
  // Log the original error to preserve its stack trace
  logger.error(error, 'uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof Error) {
    // Preserve the original rejection error and its stack
    logger.error(reason, 'unhandledRejection');
  } else {
    // For non-Error rejections, log a descriptive error and attach the original reason
    logger.error(new Error('unhandledRejection: non-Error rejection'), { reason });
  }
});
```

- `uncaughtException` and `unhandledRejection` MUST be logged — never silenced.
- These are last-resort handlers — business code should catch its own errors.

---

## Health & readiness endpoints (must)

- `/health` (liveness) and `/readiness` endpoints MUST exist on every service.
- `/health` returns 200 if the process is alive (lightweight, no dependency checks).
- `/readiness` returns 200 if the service can accept traffic — MAY verify critical dependencies (DB connection, Redis ping).
- Both endpoints MUST be excluded from:
  - Authentication middleware.
  - Telemetry/logging middleware (no log lines on health checks).
  - Rate limiting.

---

## Forbidden patterns (must not)

- ❌ Telemetry initialized after application code (late init misses early traces/logs).
- ❌ Missing `app.enableShutdownHooks()` — providers won't get shutdown signals.
- ❌ Any provider with a connection missing `onApplicationShutdown()` (SQS, Redis, SES, DB, etc.).
- ❌ Empty `uncaughtException` / `unhandledRejection` handler (swallows the error).
- ❌ `process.exit()` without waiting for graceful shutdown to complete.
- ❌ Log lines emitted by health/readiness endpoints (generates noise and cost).
- ❌ Entrypoint without `exec` — SIGTERM gets absorbed by the shell, Node never receives it.
- ❌ Missing Istio `terminationDrainDuration` in Helm values (active connections get dropped).

## Review checks (look for)

- 🔴 Telemetry import not at the top of `main.ts`.
- 🔴 Missing `app.enableShutdownHooks()`.
- 🔴 Provider with connection (Redis, SES, SQS, DB) missing `onApplicationShutdown()`.
- 🔴 `uncaughtException` or `unhandledRejection` handler that doesn't log.
- 🔴 Health endpoint with auth middleware or logging.
- 🔴 `entrypoint.sh` without `exec` (SIGTERM won't reach Node).
- 🟡 SQS consumer missing `isShuttingDown` guard on reconnect logic.
- 🟡 `process.exit(1)` called without awaiting graceful shutdown.
- 🟡 Conditional consumers without clear env var naming convention.
- 🟡 Missing `terminationDrainDuration` in Helm pod annotations for Istio.
