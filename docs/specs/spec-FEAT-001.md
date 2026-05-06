# Spec: Listar compras del wallet (GET /wallet/purchases)

| Métrica | Valor |
|---------|-------|
| Ticket | FEAT-001 |
| Jira | sin ticket |
| PRD | docs/prd/prd-FEAT-001.md |
| Fecha | 2026-05-06 |
| Loops PRD | 0 |
| Loops Spec | 0 |

## Resumen Técnico

Se agrega un endpoint `GET /wallet/purchases` al `WalletController` existente. Devuelve un listado paginado de compras (orden `createdAt DESC`) con filtro opcional por `itemId`. Reutiliza el `PurchaseRepository`/`WalletService` ya presentes; se les agrega un método nuevo (`findAndCount`/`listPurchases`) sin modificar la firma del POST. La validación de query params se hace via `ValidationPipe` global con un DTO dedicado (`PurchaseListInputDto`) que aplica `transform` para coercer strings a números. La respuesta usa un DTO nuevo (`PurchaseListOutputDto`) con `data` + `pagination`.

## Arquitectura

```
GET /wallet/purchases?page&limit&itemId
        │
        ▼
  WalletController.listPurchases (presentación)
        │  @Query() PurchaseListInputDto  (validación + coerción)
        ▼
  WalletService.listPurchases (dominio)
        │  filter:{itemId?}, pagination:{page,limit}
        ▼
  PurchaseRepository.findAndCount (data)
        │  TypeORM: findAndCount({ where, order, skip, take })
        ▼
  SQLite (purchases)
        │  → Purchase[] (entidades) + total
        ▲
  WalletController arma PurchaseListOutputDto
```

Sin nuevos módulos, sin nuevas dependencias, sin migraciones de schema.

## Threat Model

Documento completo en `docs/security/threat-FEAT-001.md`. Mitigaciones incorporadas al diseño:

- **Validación estricta de query params** (T): `PurchaseListInputDto` con `@Type(() => Number)`, `@IsInt`, `@Min(1)`, `@Max(100)` para `page`/`limit`; `@IsString`, `@MaxLength(64)` para `itemId`. ValidationPipe global ya configurado con `whitelist: true, transform: true`.
- **Parametrized queries** (T): `findAndCount({ where: { itemId } })` de TypeORM usa bind parameters; no se construye SQL por concatenación.
- **Cap en `limit ≤ 100`** (D): protege contra payloads gigantes.
- **No exposición de stacktraces** (I): `GlobalExceptionFilter` ya filtra, `RepositoryException.meta` sin PII.
- **Riesgos aceptados**: sin auth (RA-01), sin rate limiting (RA-02). Documentados con justificación y condición de revisión.

## Bloque 1: DTOs de entrada y salida

Cubre RF-03, RF-04, RF-05, RF-06, RF-07, RF-09 (estructura de request/response y validación).

### Archivos a crear/modificar:

- `src/modules/wallet/controllers/dtos/purchase-list-input.dto.ts` — **nuevo**. DTO de query params.
- `src/modules/wallet/controllers/dtos/purchase-list-output.dto.ts` — **nuevo**. DTO de respuesta paginada.

### Lógica:

**`PurchaseListInputDto`** (clase con class-validator + class-transformer):

| Campo | Tipo | Decoradores |
|-------|------|-------------|
| `page` | `number` | `@Type(() => Number)`, `@IsOptional()`, `@IsInt()`, `@Min(1)`. Default aplicado en el service: 1. |
| `limit` | `number` | `@Type(() => Number)`, `@IsOptional()`, `@IsInt()`, `@Min(1)`, `@Max(100)`. Default aplicado en el service: 20. |
| `itemId` | `string` | `@IsOptional()`, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(64)`. |

Razón de `@Type` en lugar de `@IsNumberString`: con `transform: true` global, `@Type(() => Number)` convierte `"2"` → `2` antes de aplicar `@IsInt`/`@Min`/`@Max`. Si la conversión produce `NaN` o un valor inválido, los validadores lo rechazan con 400.

**`PurchaseListOutputDto`** (clase con factory estática):

```ts
class PaginationDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

class PurchaseListOutputDto {
  data!: PurchaseOutputDto[];
  pagination!: PaginationDto;

  static fromEntities(
    purchases: Purchase[],
    total: number,
    page: number,
    limit: number,
  ): PurchaseListOutputDto;
}
```

`fromEntities` mapea cada `Purchase` con `PurchaseOutputDto.fromEntity` y calcula `totalPages = Math.ceil(total / limit)` (con `total === 0` → `totalPages = 0`).

### Tests requeridos:

- [ ] `PurchaseListOutputDto.fromEntities` con `total = 0` retorna `data: []`, `pagination.totalPages = 0` (cubre AC-01).
- [ ] `PurchaseListOutputDto.fromEntities` con `total = 25, limit = 20` retorna `pagination.totalPages = 2` (cubre AC-02).
- [ ] `PurchaseListOutputDto.fromEntities` mapea cada `Purchase` con shape correcto (cubre RF-06, AC-09).

### Criterio de completado:

Ambos DTOs existen, exportan las clases nombradas, los tests unit del bloque pasan en aislamiento.

---

## Bloque 2: Repositorio — `findAndCount`

Cubre RF-01 (acceso a datos), RF-02 (orden), RF-03 (paginación a nivel SQL), RF-04 (filtro), RF-08 (filtro vacío).

### Archivos a crear/modificar:

- `src/modules/wallet/repositories/purchase.repository.ts` — **modificar**. Agregar método `findAndCount(filter, pagination)`.

### Lógica:

```ts
async findAndCount(
  filter: { itemId?: string },
  pagination: { skip: number; take: number },
): Promise<{ purchases: Purchase[]; total: number }>
```

Implementación (siguiendo el patrón de `ItemRepository.findAll`):

1. Construir `where: FindOptionsWhere<PurchaseModel> = {}`. Si `filter.itemId` está presente, asignar `where.itemId = filter.itemId`.
2. Llamar `this.repository.findAndCount({ where, order: { createdAt: 'DESC' }, skip: pagination.skip, take: pagination.take })`.
3. Mapear cada `model` a entidad con `model.toEntity()`.
4. Devolver `{ purchases, total }`.
5. Wrap del error en `RepositoryException` con `code: 'PURCHASE_REPOSITORY_FIND_AND_COUNT_FAILED'`, `severity: 'recoverable'`, `retryable: true`, `meta: { itemId: filter.itemId, skip, take }`.

### Tests requeridos:

- [ ] Integration NO requerido (TypeORM `findAndCount` es built-in; el método del repo es delegación + mapping). Verificación end-to-end via e2e del controller (Bloque 4) cubre los ACs.
- [ ] Si la implementación introduce lógica condicional no trivial (ej: branching del where), agregar unit con `createMock<Repository<PurchaseModel>>()` para esa rama.

### Criterio de completado:

El método existe, compila, lint pasa, e2e del Bloque 4 pasa contra este repo (no se mockea en e2e).

---

## Bloque 3: Service — `listPurchases`

Cubre RF-01, RF-02, RF-03 (defaults + traducción a skip/take), RF-04, RF-08, RF-09 (no entidad de dominio para "no resultados", devuelve array vacío).

### Archivos a crear/modificar:

- `src/modules/wallet/services/wallet.service.ts` — **modificar**. Agregar método `listPurchases`.

### Lógica:

```ts
async listPurchases(input: {
  page?: number;
  limit?: number;
  itemId?: string;
}): Promise<{ purchases: Purchase[]; total: number; page: number; limit: number }>
```

1. Aplicar defaults: `page = input.page ?? 1`, `limit = input.limit ?? 20`.
2. Calcular `skip = (page - 1) * limit`, `take = limit`.
3. Llamar `purchaseRepository.findAndCount({ itemId: input.itemId }, { skip, take })`.
4. Devolver `{ purchases, total, page, limit }`.

No emite logs (boundary-only logging). Errores del repo propagan tal cual (ya envueltos en `RepositoryException`).

### Tests requeridos:

- [ ] Aplica defaults `page=1, limit=20` cuando no se pasan (cubre comportamiento de RF-03).
- [ ] Calcula `skip = (page-1)*limit` correctamente para `page=2, limit=20` → `skip=20` (cubre AC-03).
- [ ] Forwarda `itemId` al repo cuando se provee (cubre AC-05).
- [ ] No pasa `itemId` (o lo pasa undefined) cuando no se provee (cubre AC-04, AC-08).
- [ ] Propaga `RepositoryException` cuando el repo falla (sad path).

Tests usan `createMock<PurchaseRepository>()` y `createMock<MarketplaceService>()` — instanciación directa, sin `Test.createTestingModule`, según `tdd.md` y `testing.md`.

### Criterio de completado:

5 unit tests pasando. Cobertura de líneas y ramas del método ≥ 80%.

---

## Bloque 4: Controller — `GET /wallet/purchases`

Cubre RF-01 (endpoint expuesto), RF-05 (response shape), RF-07 (400 en validación), RNF-02 (logs/trace propagados — vienen del middleware existente), RNF-03 (validación via class-validator).

### Archivos a crear/modificar:

- `src/modules/wallet/controllers/wallet.controller.ts` — **modificar**. Agregar handler `@Get('purchases') listPurchases(@Query() input)`.

### Lógica:

```ts
@Get('purchases')
async listPurchases(@Query() input: PurchaseListInputDto): Promise<PurchaseListOutputDto> {
  const result = await this.walletService.listPurchases({
    page: input.page,
    limit: input.limit,
    itemId: input.itemId,
  });
  return PurchaseListOutputDto.fromEntities(
    result.purchases,
    result.total,
    result.page,
    result.limit,
  );
}
```

El `ValidationPipe` global se encarga de:
- `whitelist`: descarta query params no declarados en el DTO.
- `transform`: convierte strings de query a `number` para `page`/`limit`.
- Si la validación falla → 400 automático con detalles.

### Contrato del endpoint

| Aspecto | Valor |
|---------|-------|
| Método | `GET` |
| Path | `/wallet/purchases` |
| Query params | `page` (int ≥ 1, opt, default 1), `limit` (int 1..100, opt, default 20), `itemId` (string ≤ 64 chars, opt) |
| Auth | Ninguna (RA-01 — riesgo aceptado documentado en threat model) |
| Response 200 | `{ data: PurchaseOutputDto[], pagination: { page: number, limit: number, total: number, totalPages: number } }` |
| Response 400 | `{ statusCode: 400, message: [...], error: 'Bad Request' }` (formato estándar de `ValidationPipe`) — cuando `page < 1`, `limit < 1`, `limit > 100`, tipos no convertibles, `itemId` vacío o demasiado largo. |
| Response 500 | `{ error: 'PURCHASE_REPOSITORY_FIND_AND_COUNT_FAILED', message: '...' }` (formato `GlobalExceptionFilter`) si falla la DB. |

### Manejo de errores

- Errores de validación → 400 (ValidationPipe → `BadRequestException` → GlobalExceptionFilter no captura, NestJS responde directo con shape estándar).
- Errores de repositorio → propaga `RepositoryException` → `GlobalExceptionFilter` → log WARN + responde con `httpStatus` (default 400 para `recoverable`).
- Sin try/catch en el controller (boundary-only logging via filter).

### Tests requeridos:

- [ ] e2e: 0 compras → 200 con `data: []`, `pagination = { page:1, limit:20, total:0, totalPages:0 }` (AC-01).
- [ ] e2e: 25 compras → 200 con `data.length=20`, `pagination.total=25`, `page=1`, `totalPages=2` (AC-02).
- [ ] e2e: 25 compras + `?page=2&limit=20` → 200 con `data.length=5`, `page=2` (AC-03).
- [ ] e2e: orden `createdAt DESC` — 2 compras P1 (anterior) y P2 (posterior) → `data[0].id === P2.id` (AC-04).
- [ ] e2e: `?itemId=itm_001` con compras de varios items → solo compras de `itm_001`, `pagination.total` consistente (AC-05).
- [ ] e2e: `?page=0` → 400 (AC-06).
- [ ] e2e: `?limit=200` → 400 (AC-07).
- [ ] e2e: `?itemId=no_existe` → 200 con `data: []`, `total=0` (AC-08).
- [ ] e2e: shape de cada item del `data` matchea `{ id, itemId, itemName, quantity, totalAmount, createdAt }` (AC-09).

Los tests e2e siguen el patrón de `test/e2e/wallet.e2e-spec.ts`: `createTestApp()`, supertest, `afterAll(app.close())`. Setup: para tests con compras pre-existentes, hacer `POST /wallet/purchases` antes de cada bloque.

### Criterio de completado:

9 tests e2e pasando + 5 unit tests del service (Bloque 3) + 3 tests del DTO (Bloque 1). Lint y type checker pasan.

---

## Dependencias entre Bloques

```
Bloque 1 (DTOs) ─┐
                 ├─→ Bloque 4 (Controller)
Bloque 2 (Repo) ─┴─→ Bloque 3 (Service) ─┘
```

Orden sugerido de implementación:
1. Bloque 1 (DTOs) — independiente.
2. Bloque 2 (Repository) — independiente.
3. Bloque 3 (Service) — depende de Bloque 2.
4. Bloque 4 (Controller) — depende de Bloques 1 y 3.

## Riesgos Técnicos

- **R-T-01**: `class-transformer` con `transform: true` puede aceptar valores raros (ej: `"abc"` → `NaN`). **Mitigación**: `@IsInt()` rechaza `NaN`. Validar con un test explícito (`?page=abc` → 400).
- **R-T-02**: `@Type(() => Number)` aplicado a `page`/`limit` cuando son opcionales y vienen ausentes. **Mitigación**: combinarlo con `@IsOptional()` antes de los demás validadores; si el valor es `undefined`, los validadores no se ejecutan.
- **R-T-03**: Concurrencia entre `findAndCount` (count + select) sin transacción → `total` puede no coincidir con `data.length` si hay escrituras simultáneas. **Aceptado** (documentado en PRD como R-02). Hackathon, best effort.

## Notas de Seguridad

- **No agregar logs en service ni repository** — boundary-only logging (rule `error-handling.md`). La `RepositoryException` ya se loguea en el `GlobalExceptionFilter`.
- **No PII en `meta`** del `RepositoryException` — solo IDs técnicos (`itemId`, `skip`, `take`). El `itemId` es un identificador de catálogo, no PII.
- **No usar `Math.random` ni timestamps** para IDs — los IDs siguen siendo UUID v4 generados en el POST.
- **No mezclar cuerpo de request en el GET** — el handler usa solo `@Query()`, no `@Body()`.
