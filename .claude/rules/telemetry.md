---
paths:
  - "**/*.ts"
  - "**/*.js"
---
# Telemetry — Logs, Metrics & Traces (Node.js Backend)

## Hard rules (must)

- **All telemetry follows the organization-wide standard** (RFC 2119 severity: MUST, SHOULD, MAY).
- **Three pillars**: Logs, Metrics, and Traces. Prefer traces for troubleshooting; use logs only when traces are insufficient.

---

## Logs

### Format (must)

- All logs MUST be **JSON**, **single-line**, emitted to **STDOUT**.
- All JSON field names (nested or not) MUST be **snake_case**.
- Each log entry MUST be **< 5KB** total. Oversized logs will be dropped.
- Objects MUST be logged as part of the JSON structure — never serialized into a string field (no `inspect()`, no `JSON.stringify` inside a message string).

### What NOT to log (must)

- ❌ Health endpoints (`/health`, `/readiness`).
- ❌ Operational query endpoints (e.g., actuator-style).
- ❌ Objects of unknown origin or structure (risk of PII leak and size explosion).

### Log levels (must)

| Level | When to use | Rules |
|-------|------------|-------|
| **ERROR** | Exceptions that terminate an operation or business flow. | One exception = exactly one ERROR log. Controlled (caught) exceptions MUST NOT produce ERROR unless they cause a condition of error on the operation. A catch that re-throws MUST NOT produce an ERROR log. |
| **WARN** | Must satisfy ALL three conditions: (1) indicates a possible bug or corrupt behavior, (2) requires developer attention (should have an alert), (3) is solvable with a short-term mitigation plan. If the team decides not to fix it, the WARN line MUST be removed. | |
| **INFO** | Only for justified cases where traces are insufficient: MVP launches needing transaction-level debugging, security/compliance audit trails, hard-to-reproduce bugs (temporary), concurrency debugging (temporary). Teams must remember INFO logs are expensive and count toward squad budget. | |
| **DEBUG** | Detailed execution flow for troubleshooting. NOT ingested by default — only available via Debug Mode or live tail. | |

### Special events

Four event types that MAY be logged but MUST use unified format via standardized tooling:

1. **Exceptions** — MUST always be logged when they produce an error condition. Follow the error-handling instructions.
2. **External calls** (DB, HTTP, AWS) — RECOMMENDED to avoid in INFO; APM traces should suffice.
3. **Request start** logs — via standardized tooling only.
4. **Request end** logs — via standardized tooling only.

### PII — strict (must)

Never log or attach as metadata:
- Emails, national IDs, bank account identifiers, card numbers, authentication tokens, JWTs.
- This applies to message strings, error objects, breadcrumbs, and extra metadata.
- Strings that look like JWTs, high-entropy strings (passwords), and PII will be **obfuscated or dropped** by infrastructure.

### Debug Mode

- Activated when a log has root attribute `debug_mode: true`.
- Telemetry tooling MUST support enabling/disabling debug mode per trace.
- When enabled: all logs for the operation get `debug_mode: true`, and trace attributes from the fields standard are emitted.
- Activation: any request with header `x-debug-mode: true`.
- Propagation: via W3C `Baggage` header (`debug_mode=true`) and via `metadata.debug_mode` in SQS/EventBridge messages.
- Debug mode logs have **24-hour retention**.

### Retention

- Default retention: **15 days**. Teams may opt for shorter retention (e.g., 3 days for purely technical logs).
- Configure via `modo_log_bucket` attribute on log entries.

---

## Metrics

### Naming (must)

```
modo.$SERVICE.$INDICATOR
```

- `$SERVICE`: canonical service name with hyphens converted to underscores (e.g., `post_payment_api`).
- Names MUST be alphanumeric lowercase, underscores, and dots only.
- Names MUST use **snake_case**.
- Total name length MUST NOT exceed 200 characters. RECOMMENDED < 100 characters.
- Names MUST be descriptive. Avoid ambiguous abbreviations.

### Tags (must)

```
$KEY:$VALUE
```

- `$KEY` MUST be **snake_case**, alphanumeric lowercase, must not end in underscore.
- `$VALUE` MAY be Unicode.
- Total tag length MUST NOT exceed 200 characters. RECOMMENDED < 100 characters.
- Prefer consistency over precision across all teams (e.g., don't mix `p99` and `percentile_99`).

### Cardinality (must)

- Max **7,000 time series** per metric. Alert at 5,000, incident at 7,000.
- All data in tags MUST have **known cardinality at build time**.
- External data (request body, URL params) MUST be sanitized to a bounded set of values (buckets or categories like `other`).
- MUST NOT use unsanitized data in tags.

### Implementation pattern

```typescript
import { StatsD } from 'hot-shots';
const ddStats = new StatsD();

// Counter
ddStats.increment('modo.post_payment_api.payment_processed', [
  `status:${status}`,
  `type:${paymentType}`,
]);

// Timing
ddStats.timing('modo.post_payment_api.provider_response_time', durationMs, [
  `provider:${providerName}`,
]);
```

---

## Traces

### Context propagation (must)

- All components MUST use **W3C Trace Context** standard for trace IDs and context propagation.
- Logs MUST include `trace_id` (from `traceparent` header `trace-id` field) and `span_id` (from `parent-id` field).
- If `tracestate` is present, log a `trace_state` object with its parsed values.
- Spans are **manually instrumented** (no automatic Express middleware spans).

### Retrocompatibility

- Banks may send `x-request-id` header — propagate it via W3C `tracestate`.

### Universal tags (must)

Every manually created trace entity MUST include (where applicable):
- `service`
- `env`
- `team`
- `version`

Missing tags may break platform automations (monitors, SLOs, APM service pages).

---

## Forbidden patterns (must not)

- ❌ Using `console.log` / `console.error` / `console.warn` — use the structured logger.
- ❌ Using `inspect()` to serialize objects into log messages.
- ❌ Logging full HTTP request/response payloads (size + PII risk).
- ❌ Emitting INFO logs without justification (see log levels table).
- ❌ Using unsanitized external data in metric tags.
- ❌ Metric names with special characters beyond alphanumeric, underscore, and dot.

## Review checks (look for)

- 🔴 `console.log`, `console.error`, `console.warn` usage in production code.
- 🔴 PII in log messages, error metadata, or metric tags.
- 🔴 Log lines in health/readiness endpoints.
- 🔴 `inspect()` used to serialize objects for logging.
- 🔴 Metric tag using unsanitized user input (unbounded cardinality).
- 🔴 Multiple ERROR logs for the same exception (see error-handling instructions).
- 🟡 INFO log without a comment justifying why traces are insufficient.
- 🟡 Metric name exceeding 100 characters.
- 🟡 Missing `trace_id` / `span_id` in structured log output.
- 🟡 Missing universal tags (`service`, `env`, `team`, `version`) on custom trace spans.
