---
paths:
  - "**/*.ts"
  - "**/*.js"
---
# Architecture Review — Clean Architecture + DDD (Node.js Backend)

## Hard rules (must)

- **Layered architecture**: every service is organized in three layers with a strict dependency direction:
  - **Presentation** (Controllers, CLI, SQS consumers) → **Domain** (Services, Entities) → **Infrastructure** (DB, HTTP clients, AWS, Redis, Logger, Telemetry)
- **The Dependency Rule**: dependencies only point inward. Inner layers never import or reference outer layers.
- **Entities are pure**:
  - Domain entities are POJOs or plain classes with zero framework dependencies.
  - No decorators, no ORM annotations, no HTTP concepts, no logging.
  - May have behavior (methods) and compose other entities.
  - Must be immutable (readonly properties or frozen objects).
- **Repositories abstract data access**:
  - Repository methods receive and return **domain entities**, never ORM models or DTOs.
  - Mapping between domain entities and data models is the repository's responsibility.
  - **Composition over inheritance**: repositories inject the ORM repository as a private field (`@InjectRepository`), they do NOT extend it (`extends Repository<T>`). This decouples business code from the ORM and simplifies testing.
- **Services contain business logic**:
  - Orchestrate repositories, entities, and domain rules.
  - Do not depend on HTTP concepts (no `req`/`res`, no status codes, no headers).
  - A service from one feature may depend on services from other features — never on their repositories.
- **Controllers adapt the outside world**:
  - Transform HTTP requests into service calls and service responses into HTTP responses.
  - Own their DTOs (input/output). DTOs are specific to this layer.
  - Handle error-to-HTTP-status mapping via interceptors or filters.
- **Infrastructure is shared and self-contained**:
  - Contains DB connections, HTTP clients, logger, telemetry, cache clients.
  - Does NOT import Services or Controllers.
  - Any feature can use infrastructure components.

## Layer dependency matrix

| Layer | Can depend on | Must NOT depend on |
|-------|--------------|-------------------|
| **Entities** | Other entities only | Services, Repositories, Controllers, Infrastructure, any framework |
| **Repositories** | Entities, Infrastructure | Services, Controllers |
| **Services** | Entities (own + cross-module), Repositories (own module), Services (cross-module), Infrastructure | Controllers, DTOs, ORM models |
| **Controllers** | Services (any module), Entities (any module), Infrastructure | Repositories, ORM models |
| **Infrastructure** | Only infrastructure components | Services, Controllers, Repositories |

## Directory structure per feature (bounded context)

```
src/
├── modules/
│   └── [feature-name]/
│       ├── controllers/
│       │   ├── dtos/
│       │   │   ├── [feature]-input.dto.ts
│       │   │   └── [feature]-output.dto.ts
│       │   ├── interceptors/
│       │   └── [feature].controller.ts
│       ├── entities/
│       │   └── [feature].entity.ts
│       ├── repositories/
│       │   ├── models/
│       │   │   └── [feature].model.ts
│       │   └── [feature].repository.ts
│       ├── services/
│       │   ├── exceptions/
│       │   │   └── [feature]-not-found.exception.ts
│       │   └── [feature].service.ts
│       └── [feature].module.ts
├── infrastructure/
│   ├── exceptions/
│   ├── api-clients/
│   │   ├── dtos/
│   │   └── http.[external-service].client.ts
│   ├── logger.ts
│   └── telemetry.ts
├── config.ts
├── app.module.ts
└── main.ts
```

## Bounded context as module

Each feature directory represents a **bounded context** (DDD). A bounded context answers: _what entities and concepts from my business domain are involved in the problem I'm solving?_ The effort to define these entities and their relationships produces a shared **ubiquitous language** between code, engineers, and stakeholders.

## Forbidden patterns (must not)

- ❌ Controller importing a repository or ORM model directly.
- ❌ Service importing controller DTOs or returning HTTP-specific types.
- ❌ Entity with framework decorators (`@Entity`, `@Column`, `@Injectable`).
- ❌ Infrastructure component importing a service or controller.
- ❌ Cross-module access to another module's repositories (use their exported service instead).
- ❌ Business logic inside controllers (validation beyond DTO shape is business logic).

## Review checks (look for)

- 🔴 Import path from a controller file reaching into `repositories/` or `models/`.
- 🔴 Entity file importing from `typeorm`, `@nestjs/*`, `aws-sdk`, or any infrastructure package.
- 🔴 Service returning or receiving a DTO class defined in `controllers/dtos/`.
- 🔴 Repository returning an ORM model instead of a domain entity.
- 🟡 Service directly using `logger` or `metrics` from infrastructure — allowed, but verify it's not leaking HTTP context.
- 🟡 Feature directory missing the `entities/` subdirectory (might indicate anemic domain or missing domain modeling).

> **Example**: see [examples/before-after-2.md](examples/before-after-2.md) — controller directo vs Clean Architecture con DIP.
