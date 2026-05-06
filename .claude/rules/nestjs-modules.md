---
paths:
  - "**/*.ts"
  - "**/*.js"
---
# NestJS Modules — Bounded Context Encapsulation

> Applies to services using `@nestjs/core`. For non-NestJS services, see architecture.instructions.md.

## Hard rules (must)

- **One module = one bounded context**: each `@Module()` encapsulates a single business domain (e.g., `UsersModule`, `PaymentsModule`).
- **Internal structure per module**:
  ```
  [feature-name]/
  ├── controllers/
  │   ├── dtos/
  │   └── interceptors/
  ├── entities/
  ├── repositories/
  │   └── models/
  ├── services/
  │   └── exceptions/
  └── [feature-name].module.ts
  ```
- **`exports` array discipline**:
  - Only export **Services** that other modules need.
  - Never export repositories, models, DTOs, or controllers.
- **`providers` array**: register all services, repositories, and internal components of the module.
- **`controllers` array**: register all controllers — they are never exported.
- **`imports` array**:
  - `TypeOrmModule.forFeature([...])` for ORM model registration.
  - Other feature modules (to access their exported services).
  - Infrastructure modules (database, config, etc.).

## Cross-module access (must)

- To use a service from another module: import the module, then inject the service.
- ❌ Never import a provider directly from another module's internal files without importing the module.

### Example

```typescript
// src/modules/users/user.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([UserModel])],
  controllers: [UserController],
  providers: [UserRepository, UserService],
  exports: [UserService], // Only the service
})
export class UserModule {}

// src/modules/payments/payment.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentModel]),
    UserModule, // Import the module to access UserService
  ],
  controllers: [PaymentController],
  providers: [PaymentRepository, PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
```

## Test structure

Tests mirror the module structure inside `test/`:

```
test/
└── modules/
    └── [feature-name]/
        ├── controllers/
        │   └── [feature].controller.spec.ts
        ├── repositories/
        │   └── [feature].repository.spec.ts
        └── services/
            └── [feature].service.spec.ts
```

## Forbidden patterns (must not)

- ❌ Exporting repositories, models, or DTOs from a module.
- ❌ Exporting controllers.
- ❌ Importing a service directly via file path from another module without importing its `@Module()`.
- ❌ Circular module imports (A imports B, B imports A) — use `forwardRef()` only as last resort, prefer restructuring.
- ❌ Putting business logic in `app.module.ts` — it should only aggregate modules.
- ❌ A module with mixed bounded contexts (e.g., `UsersAndPaymentsModule`).

## Review checks (look for)

- 🔴 `exports` array containing a repository, model, or DTO class.
- 🔴 `exports` array containing a controller.
- 🔴 Import path reaching into another module's `repositories/`, `models/`, or `controllers/dtos/`.
- 🔴 `forwardRef()` usage (investigate why there's a circular dependency).
- 🟡 Module without a clear bounded context boundary (too many unrelated providers).
- 🟡 Feature module missing the `entities/` directory.
- 🟡 Test directory not mirroring the module's internal structure.
