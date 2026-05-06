# wallet-vu-hackathon

NestJS API mock para hackathon — marketplace + wallet con SQLite in-memory y datos seed al boot.

## Quick start

```bash
npm install
npm run start:dev          # http://localhost:3000
```

Otros comandos:

```bash
npm run build              # compilar a dist/
npm test                   # unit tests
npm run test:e2e           # e2e tests
npm run test:all           # todos + coverage
npm run lint               # eslint sobre src/ y test/
npm run lint:fix           # eslint --fix
```

## Endpoints

| Método | Path | Descripción |
|---|---|---|
| GET | `/health` | Liveness (k8s) |
| GET | `/readiness` | Readiness (k8s) |
| GET | `/marketplace/items` | Lista zapatillas mockeadas. Acepta `?color=` |
| POST | `/wallet/purchases` | Crea compra (`{ itemId, quantity }`) |

## Probar con cURL

> Asume server corriendo en `localhost:3000`.

### Health checks

```bash
curl -s http://localhost:3000/health
# → {"status":"ok"}

curl -s http://localhost:3000/readiness
# → {"status":"ready"}
```

### Listar items

```bash
curl -s http://localhost:3000/marketplace/items | jq
```

Response (200):

```json
[
  {
    "id": "itm_001",
    "name": "Nike Air Max 270",
    "description": "Zapatillas urbanas con cámara de aire visible",
    "price": 285000,
    "imageUrl": "https://placehold.co/400x400?text=AirMax+Negro",
    "color": "negro"
  },
  ...
]
```

Catálogo: 10 modelos de zapatillas (`itm_001` … `itm_010`). Precios en **ARS** (Argentina, sin centavos), rangos 2026: `89.000` … `450.000`.

Colores disponibles: `negro`, `blanco`, `rojo`, `azul`, `gris`, `verde`.

### Filtrar por color

```bash
curl -s "http://localhost:3000/marketplace/items?color=negro" | jq
# → solo zapatillas color=negro

curl -s "http://localhost:3000/marketplace/items?color=violeta" | jq
# → []
```

### Crear compra (happy path)

```bash
curl -s -X POST http://localhost:3000/wallet/purchases \
  -H "Content-Type: application/json" \
  -d '{"itemId":"itm_001","quantity":2}' | jq
```

Response (201):

```json
{
  "id": "bfb926f6-a593-4348-93c4-4576e7b9a0d0",
  "itemId": "itm_001",
  "itemName": "Nike Air Max 270",
  "quantity": 2,
  "totalAmount": 570000,
  "createdAt": "2026-05-06T17:29:59.770Z"
}
```

`totalAmount = price * quantity` (ARS).

### Crear compra — item inexistente (404)

```bash
curl -s -i -X POST http://localhost:3000/wallet/purchases \
  -H "Content-Type: application/json" \
  -d '{"itemId":"itm_999","quantity":1}'
```

Response:

```
HTTP/1.1 404 Not Found

{"error":"ITEM_NOT_FOUND","message":"Item itm_999 not found"}
```

`ItemNotFoundException` (extiende `ServiceException`) → mapeada por `GlobalExceptionFilter`. Loggea WARN estructurado con `code`, `severity`, `meta`, `message_chain`.

### Crear compra — payload inválido (400)

```bash
curl -s -i -X POST http://localhost:3000/wallet/purchases \
  -H "Content-Type: application/json" \
  -d '{"itemId":"","quantity":0}'
```

Response:

```
HTTP/1.1 400 Bad Request

{
  "message": ["itemId should not be empty","quantity must not be less than 1"],
  "error": "Bad Request",
  "statusCode": 400
}
```

`ValidationPipe` global rechaza con array de errores `class-validator`.

### Cantidad fuera de rango

```bash
curl -s -i -X POST http://localhost:3000/wallet/purchases \
  -H "Content-Type: application/json" \
  -d '{"itemId":"itm_001","quantity":9999}'
# → 400 {"message":["quantity must not be greater than 100"], ...}
```

`quantity` permitido: `1` … `100`.

### Distributed tracing (W3C Trace Context)

Si pasás `traceparent`, la API lo respeta y lo devuelve en la response:

```bash
curl -s -i http://localhost:3000/marketplace/items \
  -H "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" \
  | grep -i traceparent
# → traceparent: 00-0af7651916cd43dd8448eb211c80319c-...
```

Si no viene, la API genera uno nuevo. Cada log JSON incluye `trace_id` y `span_id` correlacionados.

### Debug mode

Header `x-debug-mode: true` activa flag `debug_mode: true` en logs (per-request, vía `AsyncLocalStorage`):

```bash
curl -s http://localhost:3000/marketplace/items -H "x-debug-mode: true" | jq
```

### One-liner: comprar primer item

```bash
ITEM_ID=$(curl -s http://localhost:3000/marketplace/items | jq -r '.[0].id')
curl -s -X POST http://localhost:3000/wallet/purchases \
  -H "Content-Type: application/json" \
  -d "{\"itemId\":\"$ITEM_ID\",\"quantity\":3}" | jq
```

## Arquitectura

Clean Architecture + DDD por bounded context. Reglas en [`.claude/rules/`](.claude/rules/). Detalles en [`CLAUDE.md`](CLAUDE.md).

## Variables de entorno

| Var | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DATABASE_PATH` | `:memory:` | Path SQLite (default in-memory; setear path para persistir) |
| `NODE_ENV` | `local` | Tag `env` en logs |
| `SERVICE_VERSION` | `0.1.0` | Tag `version` en logs |
| `SERVICE_TEAM` | `wallet` | Tag `team` en logs |
