---
paths:
  - "**/*.ts"
  - "**/*.js"
---
# NestJS Dependency Injection — Providers & Inversion

> Applies to services using `@nestjs/core`. For non-NestJS services, see architecture.instructions.md.

## Hard rules (must)

- **All services and repositories** MUST be decorated with `@Injectable()`.
- **Constructor injection only**: inject dependencies via the constructor, not property injection or manual instantiation.
- **Contracts over interfaces**: prefer classes (abstract or concrete) for injection tokens because they exist at runtime. TypeScript interfaces are erased and cannot be used as DI tokens.
- **Dependency Inversion Principle (DIP)**: the service layer defines what it needs (contracts); the module wiring provides concrete implementations via NestJS providers.

## Provider types

| Type | When to use | Example |
|------|------------|---------|
| **Class provider** (default) | Standard service or repository | `providers: [UserService]` |
| **`useClass`** | Swap implementation for an abstraction | `{ provide: CacheService, useClass: RedisCacheService }` |
| **`useFactory`** | Dynamic creation with dependencies | `{ provide: 'SQS_CLIENT', useFactory: (config) => new Squiss(config), inject: [ConfigService] }` |
| **`useValue`** | Constants, config objects, mocks | `{ provide: 'API_KEY', useValue: process.env.API_KEY }` |

## TypeORM repository injection

```typescript
// In the repository class
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserModel)
    private readonly repository: Repository<UserModel>,
  ) {}
}

// In the module
@Module({
  imports: [TypeOrmModule.forFeature([UserModel])],
  providers: [UserRepository, UserService],
})
export class UserModule {}
```

## Scopes (must justify)

- Default scope is **singleton** (one instance per module). This is correct for most services.
- **REQUEST scope**: only when the provider needs per-request state (e.g., request-scoped context). Justify it — request scope has performance implications because the entire dependency chain becomes request-scoped.
- **TRANSIENT scope**: rarely needed. Each consumer gets a unique instance.

## Forbidden patterns (must not)

- ❌ `new UserService(...)` in production code — manual instantiation bypasses DI. (Direct instantiation IS expected in unit tests with mocked dependencies.)
- ❌ Service Locator pattern — pulling dependencies from a global container or `app.get()` in business code.
- ❌ Circular dependencies between providers — restructure or extract a shared module.
- ❌ Property injection (`@Inject()` on a class property) — use constructor injection.
- ❌ Using TypeScript interfaces as injection tokens (they don't exist at runtime).

## Testing with DI

Mock dependencies using `@golevelup/ts-jest`:

```typescript
import { createMock, DeepMocked } from '@golevelup/ts-jest';

describe('UserService', () => {
  let userRepository: DeepMocked<UserRepository>;
  let service: UserService;

  beforeEach(() => {
    userRepository = createMock<UserRepository>();
    service = new UserService(userRepository);
  });

  it('should find user by email', async () => {
    const user = User.create('test@example.com');
    userRepository.findByEmail.mockResolvedValue(user);

    const result = await service.findUserByEmail('test@example.com');

    expect(result).toEqual(user);
    expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
  });
});
```

For integration tests that need the full DI container:

```typescript
const module = await Test.createTestingModule({
  imports: [AppModule],
}).compile();

const app = module.createNestApplication();
await app.init();

const service = app.get(UserService);
```

## Review checks (look for)

- 🔴 `new ServiceClass(...)` in production code (bypasses DI).
- 🔴 `app.get(Provider)` used outside bootstrap or test setup (service locator).
- 🔴 Missing `@Injectable()` on a class that should be a provider.
- 🔴 Property injection (`@Inject()` on a field instead of constructor parameter).
- 🔴 Circular dependency causing runtime errors or requiring `forwardRef()`.
- 🟡 REQUEST scope without documented justification.
- 🟡 Interface used as injection token (will fail at runtime).
- 🟡 Complex `useFactory` without clear documentation of what it creates.
