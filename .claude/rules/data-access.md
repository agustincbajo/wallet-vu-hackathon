---
paths:
  - "**/*.ts"
  - "**/*.js"
---
# Data Access Patterns — TypeORM, DynamoDB, Redis, SQS, API Clients (Node.js Backend)

## Hard rules (must)

- **Repositories are the only data access point**: no direct DB/cache/queue access from services or controllers.
- **Repositories receive and return domain entities**: mapping to/from data models is internal to the repository.
- **All data access errors wrap in `InfrastructureException`**: raw driver errors (ECONNRESET, ETIMEDOUT, etc.) must never propagate unwrapped.

---

## TypeORM

### Model class (must)

ORM-mapped models live in `repositories/models/` and are separate from domain entities:

```typescript
// src/modules/users/repositories/models/user.model.ts
@Entity({ name: 'users' })
export class UserModel {
  /** Maps domain entity → data model */
  static map(user: User): UserModel {
    return Object.assign(new UserModel(), {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  @PrimaryColumn({ name: 'id' })
  @IsUUID()
  public id: string = '';

  @Column({ name: 'email', nullable: false, unique: true })
  @IsEmail()
  public email: string = '';

  @Column({ name: 'created_at', nullable: false })
  public createdAt?: Date;

  @Column({ name: 'updated_at', nullable: false })
  public updatedAt?: Date;

  /** Converts data model → domain entity */
  async toEntity(): Promise<User> {
    await validateOrReject(this);
    return new User(this.id, this.email, this.createdAt as Date, this.updatedAt as Date);
  }
}
```

### Repository (must)

```typescript
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserModel)
    private readonly repository: Repository<UserModel>,
  ) {}

  async findByEmail(email: string): Promise<User | undefined> {
    const model = await this.repository.findOneBy({ email });
    return model?.toEntity();
  }

  async save(user: User): Promise<User> {
    const model = await this.repository.save(UserModel.map(user));
    return model.toEntity();
  }
}
```

### Migrations (must)

- `synchronize: false` in **all** environments — never auto-sync schema.
- Migrations live in a dedicated directory (e.g., `src/core/db/migrations/`).
- Generate with `npm run migrations:generate --name=MigrationName`.
- Run with `npm run migrations:run`.

---

## DynamoDB

- Use **AWS SDK v3** (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`).
- Repository pattern applies: wrap DynamoDB operations, return domain entities.
- Error handling: catch SDK exceptions, wrap in `InfrastructureException` with appropriate code.

---

## Redis

- Use `ioredis` client.
- Cache access through a repository or cache service — never call Redis directly from business services.
- Error handling: Redis failures are `InfrastructureException` (e.g., `REDIS_TIMEOUT`). Cache misses are NOT errors.

```typescript
// Example: wrapping a Redis timeout
try {
  return await this.redis.get(key);
} catch (error) {
  throw new InfrastructureException('Redis connection failed', {
    cause: error,
    code: 'REDIS_TIMEOUT',
    severity: 'recoverable',
    retryable: true,
    meta: { key },
  });
}
```

---

## SQS Consumers

SQS consumers are **boundaries** equivalent to HTTP controllers. They are the entry point for async processing.

### Transport strategy pattern (NestJS)

```typescript
@Injectable()
export class SQSConsumerStrategy extends Server implements CustomTransportStrategy {
  private squiss: Squiss;
  private isShuttingDown = false;

  async listen(callback: () => void) {
    this.squiss.on('message', (msg) => {
      executeInJobContext(async () => {
        await this.onMessage(msg);
      }, 'sqs-event');
    });

    this.squiss.on('error', (error: Error) => {
      logger.error(new Error('Squiss error', { cause: error }));
      if (!this.squiss.running && !this.isShuttingDown) {
        this.tryToReconnect();
      }
    });

    await this.squiss.start();
    callback();
  }
}
```

### Message handling (must)

- **Enrich log context** at the start of message processing: `addLogMetadata({ messageHandlerKey })`.
- **On success**: `await message.del()` (acknowledge and remove from queue).
- **On error**: classify the error:
  - Unrecoverable data errors (e.g., `InconsistentMessageDataException`) → `message.del()` (drop — retrying won't fix it).
  - All other errors → `message.keep()` (return to queue for retry).
- **Log errors only here** (SQS consumer is the boundary — services and repositories must not log).

### Shutdown (must)

- SQS consumers MUST implement `onApplicationShutdown()` to call `squiss.stop(true)`.
- Use an `isShuttingDown` flag to prevent reconnection attempts during shutdown.
- See `lifecycle.instructions.md` for the full graceful shutdown pattern.

### Debug mode propagation

- Check for `metadata.debug_mode` in incoming SQS message body.
- If present, activate debug mode for the entire processing trace.
- When publishing to SQS/EventBridge, include `metadata.debug_mode: true` if active.

---

## API Clients (Infrastructure)

- Live in `infrastructure/api-clients/` (or `infrastructure/` at project root).
- Each external service gets its own client file: `http.[service-name].client.ts`.
- Response DTOs are specific to infrastructure: `dtos/[service]-response.dto.ts`.
- All HTTP errors wrap in `InfrastructureException`:

```typescript
// infrastructure/api-clients/http.payment-provider.client.ts
@Injectable()
export class PaymentProviderClient {
  async getPayment(id: string): Promise<PaymentProviderResponseDto> {
    try {
      const response = await this.httpService.get(`/payments/${id}`);
      return response.data;
    } catch (error) {
      throw new InfrastructureException(`Payment provider request failed`, {
        cause: error,
        code: 'PAYMENT_PROVIDER_REQUEST_FAILED',
        severity: 'recoverable',
        retryable: error.response?.status >= 500,
        meta: { paymentId: id, status: error.response?.status },
      });
    }
  }
}
```

---

## Forbidden patterns (must not)

- ❌ `extends Repository<Entity>` — repositories use composition (`@InjectRepository` as private field), not inheritance. See architecture.instructions.md.
- ❌ Service calling `repository.find()` on a TypeORM `Repository<T>` directly — use the app's repository class.
- ❌ Repository returning an ORM model or DynamoDB item instead of a domain entity.
- ❌ Controller or service calling Redis/DynamoDB/SQS directly.
- ❌ Raw driver errors (ECONNRESET, socket errors) propagating to service layer unwrapped.
- ❌ `synchronize: true` in any environment.
- ❌ SQS consumer silently dropping failed messages without logging.
- ❌ API client without error wrapping in `InfrastructureException`.

## Review checks (look for)

- 🔴 Repository class with `extends Repository<T>` (should use composition via `@InjectRepository`).
- 🔴 `Repository<Model>` from TypeORM injected directly into a service (should go through app repository).
- 🔴 ORM model or DynamoDB item type in a service method signature.
- 🔴 Missing `InfrastructureException` wrapping on external call errors.
- 🔴 `synchronize: true` in datasource config.
- 🔴 SQS consumer with empty catch block (silently drops errors).
- 🟡 Redis cache miss treated as an error (it's a normal flow).
- 🟡 SQS consumer missing `addLogMetadata()` for message context.
- 🟡 API client response DTO used outside the infrastructure layer.
- 🟡 Missing `message.keep()` / `message.del()` decision tree on error.
