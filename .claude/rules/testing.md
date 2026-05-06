---
paths:
  - "**/*.ts"
  - "**/*.js"
---

# Testing — Unit, Integration & E2E (Node.js Backend)

## Principle — test what matters, nothing more

**Do NOT write tests just to increase coverage.** Every test must protect a real behavior that, if broken, would cause a bug in production. Before writing a test, ask: **"What production bug does this test prevent?"** If the answer is "none", don't write it.

65% coverage where every test protects real logic > 95% padded with constructor checks and mock re-assertions.

---

## Hard rules (must)

- Every conditional, domain rule, or calculation MUST have a test — this is the real coverage, not a percentage.
- Every bug fix MUST have a regression test that reproduces the original failure.
- Property-based tests (fast-check) complement domain unit tests when the input space is large. They are NOT a replacement for example-based tests — always pair both.
- Do NOT write tests to raise a coverage metric. They are waste and must be removed.
- Three test types by layer (see table below), Arrange-Act-Assert pattern.
- Tests live alongside `src/` following the project's conventions — for example, `tests/` (e.g. `tests/unit`, `tests/integration`, `tests/e2e`) or `test/` mirroring `src/`. Prefer the existing layout in the repo you are working on.
- Coverage ≥ 90% is a CI guideline for visibility, NOT a gate.

---

## Test types by component

| Component      | Type        | Verifies                                          | Dependencies                   |
| -------------- | ----------- | ------------------------------------------------- | ------------------------------ |
| **Service**    | Unit        | Business logic, orchestration, errors             | `createMock` (no DI container) |
| **Controller** | E2E         | Routing, validation, status codes, response shape | `supertest` + real app         |
| **Repository** | Integration | Custom queries, entity↔model mapping              | Real DB (Docker)               |

### Service (unit) — `createMock` + direct instantiation

```typescript
import { createMock, DeepMocked } from "@golevelup/ts-jest";

describe("UserService", () => {
  let repo: DeepMocked<UserRepository>;
  let service: UserService;

  beforeEach(() => {
    repo = createMock<UserRepository>();
    service = new UserService(repo);
  });

  it("should return user when found", async () => {
    const user = User.create("test@example.com");
    repo.findByEmail.mockResolvedValue(user);

    const result = await service.findByEmail("test@example.com");

    expect(result).toEqual(user);
  });
});
```

No `Test.createTestingModule` for unit tests — direct instantiation is faster and more isolated.

### Controller (E2E) — `supertest` against real app

```typescript
describe("GET /users/:email", () => {
  it("200 OK", async () => {
    const user = await repository.save(User.create("test@example.com"));
    const response = await request(app.getHttpServer()).get(
      `/users/${user.email}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: user.id, email: user.email });
  });

  it("404 Not Found", async () => {
    const response = await request(app.getHttpServer()).get(
      "/users/nonexistent",
    );
    expect(response.status).toBe(404);
  });
});
```

Always `afterAll(() => app?.close())` to release connections.

### Repository (integration) — only for custom queries

Skip if the repo only uses TypeORM built-ins (`save`, `findOne`). Test when there are custom queries, joins, JSON columns, or non-trivial mappings.

### External HTTP — nock (never jest.mock on HTTP clients)

```typescript
nock("https://api.external.com")
  .get("/payments/123")
  .reply(200, { id: "123", status: "completed" });

afterEach(() => nock.cleanAll());
```

nock intercepts at Node.js HTTP layer — works regardless of axios, fetch, or HttpService.

---

## Prioritization by ROI

| Priority | What                             | Type        | Why                         |
| -------- | -------------------------------- | ----------- | --------------------------- |
| **1**    | Services with conditionals/rules | Unit        | Where rules live, fast      |
| **2**    | HTTP endpoints (happy + error)   | E2E         | Max ROI — covers full stack |
| **3**    | Entities with domain logic       | Unit        | Protects invariants         |
| **4**    | Bug fixes                        | Any         | Regression, always          |
| **5**    | Custom repo queries              | Integration | Only beyond basic CRUD      |
| **6**    | SQS consumers                    | Integration | Message handling contract   |

---

## When NOT to test (intentional gaps)

Not everything needs a dedicated test:

- **CRUD repos** with TypeORM/Knex built-ins — tests the ORM, not your code
- **Module wiring**, config loading — covered by E2E
- **1:1 mappers** (entity↔model, entity↔DTO) with no transformation
- **Trivial entity factories** that only assign fields — covered by service tests
- **Thin SDK wrappers** — test would mirror the implementation
- **Constructors, getters** — tests JavaScript, not your code
- **One-off scripts** — migrations, seeds, CLI tools with no business logic

---

## Jest configuration

| Config               | Scope          | Command            |
| -------------------- | -------------- | ------------------ |
| `jest-unit.json`     | Unit (fast)    | `npm test`         |
| `jest-all.json`      | All + coverage | `npm run test:all` |
| `test/jest-e2e.json` | E2E            | `npm run test:e2e` |

Single test: `npx jest path/to/file.spec.ts --config jest-unit.json`

---

## Forbidden patterns (must not)

- ❌ **Coverage-padding**: testing constructors, getters, config, 1:1 mappers to raise a metric. Remove or rewrite.
- ❌ **Re-testing the mock**: `toHaveBeenCalledWith()` as only assertion — assert on return values or side effects instead.
- ❌ **Mirror tests**: test replicates the implementation formula. Use hand-calculated expected values.
- ❌ **Framework tests**: verifying NestJS DI, `@Body()` parsing, `ValidationPipe`. The framework tests this.
- ❌ `jest.mock()` on HTTP clients — use nock.
- ❌ Unit tests requiring a database or external service.
- ❌ Service tests using `Test.createTestingModule` — use `createMock`.
- ❌ Random loops instead of PBT: Manual `for` loops with `Math.random()` — use fast-check for reproducibility and shrinking.
- ❌ PBT for CRUD/orchestration: Property-based tests on simple delegation logic — PBT is only for pure domain logic with large input spaces.
- ❌ Tests without assertions, with PII, or depending on execution order.

## Review checks (look for)

- 🔴 Conditional logic or domain rule without a test.
- 🔴 Bug fix without a regression test.
- 🔴 Coverage-padding test (constructors, getters, config, mappers).
- 🔴 Mock-only assertion without behavior verification.
- 🔴 Mirror test (same formula in test and implementation).
- 🔴 `jest.mock('axios')` — use nock.
- 🔴 Service test with `Test.createTestingModule`.
- 🔴 Test without `expect()`, with PII.
- 🟡 Coverage below 90% — investigate missing meaningful tests, not the number.
- 🟡 Missing `afterAll(() => app?.close())` or `nock.cleanAll()`.
- 🟡 Integration test for basic CRUD repo (low ROI).

> **Example**: see [examples/before-after-3.md](examples/before-after-3.md) — test smells vs criteria-based testing.
