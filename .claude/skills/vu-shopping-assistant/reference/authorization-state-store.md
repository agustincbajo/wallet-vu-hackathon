# Authorization State Store

> Internal terminology only. Frente al usuario: "autorización de pago". Nunca decir "mandato".

## Handoff File

Persist every successful authorization in the active workspace with a timestamped name:

```text
.agents/state/vu-shopping-assistant/authorizations/auth-<YYYYMMDDTHHMMSSZ>-<transaction-id>.json
```

Also refresh this latest alias after each successful authorization:

```text
.agents/state/vu-shopping-assistant/last-authorization.json
```

The timestamped artifact is immutable history. `last-authorization.json` is the stable project-level handoff for the shopping flow to query the latest authorization. Create the directories when they do not exist.

## Write Rule

Write authorization files only when the upstream `/credentialProvider/mandate` endpoint returns `VALID`. Do not overwrite a valid saved authorization with `REJECTED`, HTTP errors, partial `PENDING` state, or local scratch state.

Use this naming pattern:

```text
auth-<YYYYMMDDTHHMMSSZ>-<safe-transaction-id>
```

Sanitize the transaction id for filenames by replacing characters outside `A-Za-z0-9._-` with `-`.

## JSON Shape

```json
{
  "schema_version": 1,
  "name": "auth-20260506T183000Z-abc123",
  "saved_at": "2026-05-06T18:30:00Z",
  "source": "vu-shopping-assistant",
  "artifact_path": ".agents/state/vu-shopping-assistant/authorizations/auth-20260506T183000Z-abc123.json",
  "latest_alias_path": ".agents/state/vu-shopping-assistant/last-authorization.json",
  "base_url": "https://dvazquez.my.to",
  "transaction_id": "<transaction-id>",
  "status": "VALID",
  "claims": {
    "max_amount": 10000,
    "merchant": "*",
    "payment_method": "MODO"
  },
  "message": "Identidad verificada",
  "signature": "<base64-signature>",
  "signature_verified": null,
  "terminal_response": {
    "id": "<transaction-id>",
    "status": "VALID",
    "message": "Identidad verificada",
    "claims": {
      "max_amount": 10000,
      "merchant": "*",
      "payment_method": "MODO"
    },
    "signature": "<base64-signature>"
  }
}
```

## Security

Never store:

- Bearer tokens.
- Verification questions.
- Human verification answers.
- Non-terminal `PENDING` responses.

Store `signature` because it is part of the authorization artifact the shopping flow may need.
