---
paths:
  - "**/*.ts"
  - "**/*.js"
---
# Naming Conventions — Node.js Backend

## File naming (must)

- All files use **kebab-case**: `user-payment.service.ts`, `approved-payment.entity.ts`.
- Files are suffixed by their role:

| Suffix | Layer | Example |
|--------|-------|---------|
| `.entity.ts` | Domain | `user.entity.ts` |
| `.service.ts` | Domain | `user.service.ts` |
| `.repository.ts` | Domain / Data | `user.repository.ts` |
| `.model.ts` | Data | `user.model.ts` |
| `.controller.ts` | Presentation | `user.controller.ts` |
| `.dto.ts` | Presentation / Infra | `user-input.dto.ts` |
| `.exception.ts` | Any layer | `payment-not-found.exception.ts` |
| `.module.ts` | NestJS | `user.module.ts` |
| `.interceptor.ts` | Presentation | `http-error.interceptor.ts` |
| `.filter.ts` | Presentation | `global-exception.filter.ts` |
| `.client.ts` | Infrastructure | `http.external-api.client.ts` |
| `.spec.ts` | Test | `user.service.spec.ts` |

## Domain entity naming (must)

- Use **pure business terminology**: `User`, `Payment`, `Subscription`, `LoyaltyProgram`.
- ❌ Must NOT include technical suffixes in domain entities: `Dto`, `Entity`, `Model`, `Response`, `Request`.
- Must be framework-agnostic — no ORM decorators, no HTTP concepts.

## Data layer model naming (must)

- Models (ORM-mapped) MUST include a technical suffix: `UserModel`, `PaymentModel`.
- DTOs for external API responses in infrastructure: `ExternalApiResponseDto`.
- Domain and data model MUST NOT share the same class name.
  - ❌ Bad: `User` (domain) and `User` (TypeORM model).
  - ✅ Good: `User` (domain) and `UserModel` (TypeORM model).

## Controller DTO naming (must)

- Input DTOs: `[feature]-input.dto.ts` → class `FeatureInputDto`.
- Output DTOs: `[feature]-output.dto.ts` → class `FeatureOutputDto`.
- DTOs are specific to the presentation layer — never share them with services or repositories.

## Exception naming (must)

- All custom exceptions extend `BaseException` and end with `Exception`:
  - ✅ `PaymentNotFoundException`, `InfrastructureException`, `RepositoryException`
  - ❌ `PaymentNotFoundError`, `PaymentError` (avoid `Error` suffix for business exceptions).
- Organize by layer:
  - Infrastructure exceptions: `infrastructure/exceptions/`
  - Service exceptions: `[feature]/services/exceptions/`

## Mapping (must)

- Mapping between domain entities and data models MUST be centralized:
  - Static factory `Model.map(entity)` on the model class converts entity → model.
  - Instance method `model.toEntity()` converts model → entity.
- Mapping logic MUST NOT live in services or controllers.
- Directionality: data layer may know domain models (for mapping); domain layer must NOT know data models.

## Contracts: classes over interfaces (should)

- Prefer **classes** for contracts instead of TypeScript interfaces, because:
  - Classes exist at runtime and can be mocked with `createMock<T>()`.
  - Interfaces are erased at compile time and require manual mock creation.
- When a contract is needed purely for typing, use an abstract class.

## Telemetry naming (must)

- Metrics and log field names MUST use **snake_case** (see telemetry instructions).
- Metric names follow: `modo.$service_name.$indicator`.

## Forbidden patterns (must not)

- ❌ camelCase or PascalCase file names (`userPayment.service.ts`).
- ❌ Domain entity named `UserEntity` or `UserModel` (entity should be just `User`).
- ❌ ORM model without a technical suffix (just `User` for the TypeORM class).
- ❌ DTO shared across presentation and service layers.
- ❌ Mapping logic scattered in services, controllers, or multiple locations.
- ❌ Exception class ending in `Error` instead of `Exception`.

## Review checks (look for)

- 🔴 File not using kebab-case (e.g., `userPayment.service.ts`).
- 🔴 Domain entity with ORM decorators or technical suffix.
- 🔴 Data model sharing the same class name as the domain entity.
- 🔴 DTO defined in `services/` or used by services directly.
- 🔴 Mapping logic inside a controller or service instead of the model class.
- 🟡 Exception class using `Error` suffix instead of `Exception`.
- 🟡 Interface used as contract where a class would enable easier mocking.
- 🟡 Missing `.map()` or `.toEntity()` on a model class.
