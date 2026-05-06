# wallet-vu-hackathon

NestJS API mock para hackathon (marketplace + wallet). SQLite in-memory, datos seed al boot.

## Reglas para LLMs

Antes de modificar código, leer reglas en `.claude/rules/`. Aplican a todo `*.ts`/`*.js`.

| Rule | Tema |
|------|------|
| `architecture.md` | Clean Architecture + DDD, dependency rule, estructura por feature |
| `naming.md` | kebab-case, sufijos `.entity/.model/.dto/.service/.repository/.controller` |
| `nestjs-modules.md` | Bounded context = módulo, exports solo services |
| `nestjs-di.md` | Constructor injection, `@Injectable()`, contracts como clases |
| `data-access.md` | Repositories devuelven entidades, mapping en `Model.map`/`model.toEntity` |
| `error-handling.md` | `BaseException`, severity, log en boundary |
| `lifecycle.md` | Bootstrap, graceful shutdown, health endpoints |
| `tdd.md` | TDD por capa |
| `testing.md` | Diamond strategy, `createMock`, supertest |
| `telemetry.md` | snake_case logs/metrics, W3C Trace Context |

## Endpoints

- `GET /health` — liveness
- `GET /readiness` — readiness
- `GET /marketplace/items?color=<color>` — listar zapatillas mockeadas (filtrable por color)
- `POST /wallet/purchases` — comprar (`{ itemId, quantity }`)

## Estructura

```
src/
  core/
    db/                      data-source + migrations
    telemetry/               ModoLogger (JSON snake_case), TraceContext middleware
  infrastructure/
    exceptions/              BaseException + layer subclasses
    filters/                 GlobalExceptionFilter
  modules/
    health/                  /health, /readiness
    marketplace/             bounded context (items)
    wallet/                  bounded context (purchases) — depende de MarketplaceService
test/
  unit/                      services, exceptions (createMock)
  e2e/                       controllers (supertest)
```

## Dev

```bash
npm install
npm run start:dev          # http://localhost:3000
npm test                   # unit
npm run test:e2e           # e2e
npm run test:all           # ambos + coverage
```

## Migrations

```bash
npm run migrations:run
npm run migrations:generate -- src/core/db/migrations/MyMigration
npm run migrations:revert
```

In-memory `:memory:` corre migrations al boot (`migrationsRun: true`). Para persistir, setear `DATABASE_PATH=/path/to.sqlite`.
