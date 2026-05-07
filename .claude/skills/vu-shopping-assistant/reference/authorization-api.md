# Authorization API Reference (a.k.a. Mandate API)

> Internal terminology only. Frente al usuario: "autorización de pago". Nunca decir "mandato" / "mandate". El path real del endpoint es `/credentialProvider/mandate`; eso es ground truth de la API y no se cambia.

## Source Of Truth

- Swagger UI: `https://dvazquez.my.to/docs`
- OpenAPI JSON: `https://dvazquez.my.to/openapi.json`
- Default base URL: `https://dvazquez.my.to`
- Local base URL: `http://localhost:8080`

The deployed OpenAPI declares `HTTPBearer` security for `POST /credentialProvider/mandate`. Runtime returns additional errors not enumerated in the OpenAPI response table.

## Endpoints

| Purpose | Method | Path | Auth |
| --- | --- | --- | --- |
| Start or advance mandate | `POST` | `/credentialProvider/mandate` | Bearer |
| Fetch public key | `GET` | `/credentialProvider/.well-known/public-key.pem` | none |
| Fetch OpenAPI | `GET` | `/openapi.json` | none |
| Swagger UI | `GET` | `/docs` | none |

## Auth

Header:

```http
Authorization: Bearer <token>
```

Always use `demo-token-1` as the Bearer token (`Authorization: Bearer demo-token-1`). Ignore `MODOVU_MANDATE_TOKEN` and any other token; do not use `demo-token-2` or real tokens.

## Request

First request starts a session. It has no `id` and no `answer`.

```json
{
  "max_amount": 10000,
  "merchant": "*",
  "payment_method": "MODO"
}
```

Follow-up request advances an existing session.

```json
{
  "id": "<transaction-id>",
  "answer": "<human-answer>"
}
```

Do not send claims in follow-up requests.

## Claims

| Field | Type | Default |
| --- | --- | --- |
| `max_amount` | number or `"*"` | `10000` |
| `merchant` | string or `"*"` | `"*"` |
| `payment_method` | string or `"*"` | `"MODO"` |

## Responses

`PENDING`:

```json
{
  "id": "<transaction-id>",
  "status": "PENDING",
  "question": "<question-text>"
}
```

`VALID`:

```json
{
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
```

`REJECTED`:

```json
{
  "id": "<transaction-id>",
  "status": "REJECTED",
  "message": "Verificación fallida"
}
```

## Errors

| Result | Agent action |
| --- | --- |
| 401 `invalid token` | Stop and request token configuration. |
| 404 `transaction not found` | Stop; report stale or lost state; ask before starting over. |
| 422 validation error | Fix request shape or obtain missing answer. |
| 409 `transaction already finalized` | Stop; treat as terminal. |
| 500 `question bank misconfigured` | Stop; report service configuration issue. |

## Signature

`VALID` signatures are base64 RSA-PSS-SHA256 over canonical JSON of the response without `signature`: sorted keys, no whitespace, UTF-8.

Verification is optional unless the user asks. Public key:

```text
GET /credentialProvider/.well-known/public-key.pem
```

