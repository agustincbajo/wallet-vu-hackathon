---
paths:
  - "**/*.ts"
  - "**/*.js"
---
# TDD — Red, Green, Refactor (Node.js Backend)

> Testing philosophy, patterns, forbidden anti-patterns, and what NOT to test are in [testing.md](testing.md). This file covers only the TDD discipline: when to apply it and how.

---

## Hard rules (must)

- **TDD is required when there is conditional logic, domain rules, or calculations** — `if`, `switch`, state transitions, validations, formulas. Write the test first.
- **Test-after is acceptable for simple delegation** — a service that calls a repo and returns, thin wrappers, straightforward mappings. The test must still exist.
- **The cycle is Red → Green → Refactor**:
  1. **Red**: write a failing test.
  2. **Green**: minimum code to pass.
  3. **Refactor**: improve without changing behavior — tests stay green.
- **Never skip Red**: if the test passes on first run, it's not testing anything new.
- **One behavior per test**: if the name uses "and", split it.

---

## Deriving test cases from acceptance criteria

```
Acceptance criteria:
  ✓ Payment is created with pending status
  ✓ Amount must be positive
  ✓ Duplicate payment within 5 minutes is rejected

Test cases:
  Entity:
    - should create payment with pending status
    - should not allow negative amount
  Service:
    - should create payment successfully
    - should throw DuplicatePaymentException within 5 min
    - should allow payment after 5 min
  Controller (E2E):
    - POST /payments → 201
    - POST /payments negative → 400
    - POST /payments duplicate → 409
```

Write ALL test cases first (Red). Implement layer by layer (Green). Refactor.

---

## TDD by layer

### Services (always TDD)

```typescript
// RED
it('should throw when payment not found', async () => {
  repo.findById.mockResolvedValue(undefined);
  await expect(service.getPayment('x')).rejects.toThrow(PaymentNotFoundException);
});

// GREEN
async getPayment(id: string): Promise<Payment> {
  const payment = await this.paymentRepository.findById(id);
  if (!payment) throw new PaymentNotFoundException(id);
  return payment;
}
```

### Entities (TDD when they have logic)

If the entity has `if`, validations, or calculations → test first. If it only assigns fields → covered by service tests.

```typescript
export class AmountMustBePositiveException extends BaseException {
  constructor(amount: number) {
    super('Amount must be positive');
    this.name = 'AmountMustBePositiveException';
  }
}

// RED
it('should not allow negative amounts', () => {
  expect(() => Payment.create('user-1', -100)).toThrow(AmountMustBePositiveException);
});

// GREEN
static create(userId: string, amount: number): Payment {
  if (amount <= 0) throw new AmountMustBePositiveException(amount);
  return new Payment(randomUUID(), userId, amount, 'pending');
}
```

### Repos and Controllers

- **Repos**: TDD only for custom queries or non-trivial mappings. Skip for basic CRUD.
- **Controllers**: write the E2E test first to define the HTTP contract, then implement.

See [testing.md](testing.md) for full code patterns.

---

## Implementation order (new feature)

Inner layers first: Entity → Service → Repository → Controller → Refactor across all. Each step follows Red → Green → Refactor internally.

---

## TDD for bug fixes

1. Write a test that reproduces the bug (Red).
2. Fix with minimum change (Green).
3. Refactor if needed.

Never fix a bug without a test that proves it was broken.

## TDD for refactoring

1. Ensure existing tests cover the behavior being refactored.
2. Refactor — tests stay green throughout.
3. No new functionality during refactor.

---

## Forbidden patterns (must not)

- Implementation first for code with conditional logic (TDD required there).
- Skipping Red — trust requires seeing the test fail first.
- Large Green steps — keep the cycle small.
- Refactoring while tests are failing — Green first, then Refactor.
- Deleting tests to make the suite pass.
- Bug fix without regression test.
- Modifying a failing test instead of fixing the implementation.

For test quality patterns (coverage padding, mock re-testing, mirror tests), see [testing.md](testing.md) §Forbidden patterns.

## Review checks (look for)

- 🔴 New conditional logic or domain rules without tests.
- 🔴 Bug fix without regression test.
- 🔴 Test that can never fail.
- 🔴 `.only` or `.skip` committed.
- 🔴 Deleted tests without justification.
- 🟡 Test cases not traceable to acceptance criteria.
- 🟡 Test name uses "and" (testing multiple behaviors).
- 🟡 Only happy-path tests — missing error scenarios.
- 🟡 Missing edge cases (null, empty, boundary).

For test smell checks (coverage padding, mirror tests, mock re-testing), see [testing.md](testing.md) §Review checks.

> **Example**: see [examples/before-after-3.md](examples/before-after-3.md) — test smells vs criteria-based testing.
