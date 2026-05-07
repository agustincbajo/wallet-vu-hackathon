# Authorization State Machine

> Internal terminology only. Frente al usuario: "autorización de pago" / "verificación con tu banco". Nunca decir "mandato".

## Core Rule

The API owns verification state. The agent owns local session memory. A follow-up request without the previous `id` is a state-loss bug.

## Transition Table

| Agent state | Request body | API response | Agent behavior |
| --- | --- | --- | --- |
| `NOT_STARTED` | optional claims, no `id`, no `answer` | `PENDING` | Save `id`, save `question`, ask human. |
| `PENDING`, first answer | `{"id":"<id>","answer":"<answer>"}` | `PENDING` | Save next question, ask human. |
| `PENDING`, second answer | `{"id":"<id>","answer":"<answer>"}` | `VALID` or `PENDING` | Save handoff and stop if `VALID`; otherwise ask third question. |
| `PENDING`, third answer | `{"id":"<id>","answer":"<answer>"}` | `VALID` or `REJECTED` | Save handoff only on `VALID`; then stop. |
| terminal | none | none | Do not call again. |

## Human Input Flow

Before the first API call:

1. If the user gave `max_amount`, `merchant`, and `payment_method`, use them.
2. If values are missing, ask for them or ask permission to use defaults.
3. Defaults are `max_amount=10000`, `merchant="*"`, `payment_method="MODO"`.

After each `PENDING`:

1. Display the returned `question` verbatim.
2. Ask for exactly one answer.
3. Ask conversationally in chat (plain text) and wait for the reply. Never use `AskUserQuestion`, `request_user_input`, or any UI form.
4. Send only `id` and `answer`.

## State Object

```yaml
authorization_session:
  base_url: "https://dvazquez.my.to"
  transaction_id: null
  status: "NOT_STARTED"
  claims:
    max_amount: 10000
    merchant: "*"
    payment_method: "MODO"
  current_question: null
  answered_count: 0
  last_response: null
  signature_verified: null
```

## Stop Conditions

Stop immediately on:

- `VALID`
- `REJECTED`
- HTTP 409
- HTTP 401 until token configuration changes
- HTTP 404 until the user decides whether to start over
- HTTP 500 until service configuration is fixed

On `VALID`, persist a timestamped artifact under `.agents/state/vu-shopping-assistant/authorizations/`, then refresh `.agents/state/vu-shopping-assistant/last-authorization.json` before reporting the terminal result. Do not persist `REJECTED` as the last authorization.

## Common Mistakes

| Mistake | Correct behavior |
| --- | --- |
| Starting another transaction after `PENDING` | Preserve and reuse the saved `id`. |
| Guessing verification answers | Ask the human or designated answer provider. |
| Resending claims during follow-up | Send only `id` and `answer`. |
| Asking all possible questions upfront | Ask only the current API question. |
| Continuing after `VALID` | Stop and report terminal result. |
| Retrying 409 | Stop; session is finalized. |
| Losing final mandate data after `VALID` | Write the persistent handoff file before ending the flow. |
