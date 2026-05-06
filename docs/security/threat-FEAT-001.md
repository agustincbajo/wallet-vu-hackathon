# Threat Model: FEAT-001 — GET /wallet/purchases

| Métrica | Valor |
|---------|-------|
| Ticket | FEAT-001 |
| Fecha | 2026-05-06 |
| Componentes en alcance | `GET /wallet/purchases` (controller), `WalletService.listPurchases`, `PurchaseRepository.findAndCount`, `PurchaseListInputDto`, `PurchaseListOutputDto` |

## Arquitectura concreta

Cliente HTTP → `WalletController.listPurchases` → `WalletService.listPurchases` → `PurchaseRepository.findAndCount` → SQLite (in-memory por defecto).

Capa de validación: `ValidationPipe` global con `whitelist: true, transform: true` aplicada al `@Query()`.

## Trust Boundaries

| ID | Cruce | Naturaleza | Controles |
|----|-------|-----------|-----------|
| TB-01 | Internet → API HTTP | Externo → aplicación | `ValidationPipe` (sanitiza/coercia query params); `GlobalExceptionFilter` (no expone stacktraces). |
| TB-02 | App → SQLite | App → almacenamiento | TypeORM `findAndCount` con parámetros tipados (no string concatenation). |

## Clasificación de Datos

| Dato | Clasificación | Justificación |
|------|---------------|---------------|
| `id` (UUID v4 random) | Público (no sensible) | Identificador opaco, sin entropía explotable. |
| `itemId`, `itemName`, `quantity`, `totalAmount` | Público (no sensible) | Datos de catálogo + cantidades de demo. Sin asociación a usuario real. |
| `createdAt` | Público | Timestamp del registro. |

**No se manejan PII, credenciales, tokens, ni datos financieros reales.** API es un mock de hackathon sin modelo de usuarios.

## Análisis STRIDE por componente

### Componente: `WalletController.listPurchases` (endpoint público)

| Categoría | Amenaza | Disposición |
|-----------|---------|-------------|
| **S** Spoofing | Cualquier cliente puede llamar el endpoint sin autenticarse. | **Riesgo aceptado** — ver sección "Riesgos aceptados". |
| **T** Tampering | Inyección de tipos no esperados en `page`, `limit`, `itemId` (ej: arrays, objetos, strings con SQL). | **Mitigado**: `ValidationPipe({ whitelist: true, transform: true })` + `@Type(() => Number)` y `@IsInt`/`@Min`/`@Max` en el DTO descartan cualquier tipo no numérico o fuera de rango (responde 400). `itemId` validado con `@IsString` y `@MaxLength`. |
| **R** Repudiation | N/A — sin modelo de actor / sin auditoría requerida en hackathon. | N/A |
| **I** Information Disclosure | Stacktraces o detalles internos en error responses. | **Mitigado**: `GlobalExceptionFilter` sólo emite `{ error, message }`. `BaseException.toLogObject` usa `meta` sin PII. |
| **I** Information Disclosure | Listado global expone compras de "otros" usuarios. | **Riesgo aceptado** — sin modelo de usuarios; no hay "otros" en este sistema. Datos no son PII. |
| **D** DoS | `limit` muy alto fuerza grandes payloads o lecturas costosas. | **Mitigado**: DTO con `@Max(100)` en `limit`. `findAndCount` con `take`/`skip` (no carga toda la tabla). |
| **D** DoS | Volumen de requests sin rate limiting. | **Riesgo aceptado** — ver sección "Riesgos aceptados". |
| **E** Elevation of Privilege | N/A — sin modelo de roles / privilegios. | N/A |

### Componente: `PurchaseRepository.findAndCount`

| Categoría | Amenaza | Disposición |
|-----------|---------|-------------|
| **T** Tampering | SQL injection vía `itemId`. | **Mitigado**: TypeORM con `where: { itemId }` usa parámetros bindeados (no concatenación). El motor SQLite recibe el valor como bind parameter. |
| **I** Information Disclosure | Errores de DB exponen schema o paths. | **Mitigado**: `RepositoryException` envuelve el error original; `meta` contiene sólo IDs de negocio. |
| **D** DoS | Query sin paginación si el caller no la pasa. | **Mitigado**: el repositorio recibe `skip`/`take` siempre desde el service (no es opcional). El DTO impone defaults válidos antes de llegar al repo. |

## Cifrado

- **En reposo**: SQLite in-memory por defecto — no persiste. Si se monta un archivo SQLite (variable `DATABASE_PATH`), no se cifra a nivel app (out of scope; cifrado opcional a nivel sistema de archivos). No hay PII almacenada, por lo que no aplica obligación regulatoria.
- **En tránsito**: out of scope para el endpoint en sí (TLS lo provee la plataforma de despliegue — Railway termina TLS antes de llegar al pod).

## Supply Chain

No se introducen dependencias nuevas. Todas las usadas (`@nestjs/*`, `typeorm`, `class-validator`, `class-transformer`) ya están en `package.json` y se reutilizan.

## Riesgos Aceptados

### RA-01: Endpoint sin autenticación

| Campo | Valor |
|-------|-------|
| Amenaza | S (Spoofing) — cualquier cliente HTTP puede listar las compras. |
| Riesgo | Acceso público a la lista de compras registradas en la demo. |
| Aceptado por | Marcelo Luksenberg (owner del proyecto) — confirmado en conversación 2026-05-06. |
| Justificación | Proyecto explícitamente declarado como "API de juguete sin auth" para hackathon. No se manejan datos reales de usuarios, ni PII, ni datos financieros productivos. El POST de compra ya es igualmente público. |
| Control compensatorio | Datos almacenados son no-sensibles (mock). El sistema se auto-resetea en cada redeploy (SQLite in-memory). |
| Condición de revisión | Si el proyecto se promueve más allá del hackathon o se conecta a usuarios reales, este riesgo deja de ser aceptable y se debe agregar autenticación (auth middleware + scoping por usuario). |

### RA-02: Sin rate limiting

| Campo | Valor |
|-------|-------|
| Amenaza | D (DoS) — un atacante puede saturar el endpoint con requests. |
| Riesgo | Degradación del servicio bajo flooding. |
| Aceptado por | Marcelo Luksenberg (owner del proyecto) — confirmado por contexto del proyecto (hackathon). |
| Justificación | Hackathon sin SLA. Plataforma de hosting (Railway) provee throttling básico de infraestructura. `limit` capeado a 100 evita explosiones de payload por request. |
| Control compensatorio | Cap en `limit ≤ 100`; SQLite in-memory tiene throughput muy alto para el volumen esperado. |
| Condición de revisión | Reevaluar si el proyecto pasa a producción con usuarios reales o si se observan abusos en métricas. |

## Resumen

| Aspecto | Estado |
|---------|--------|
| STRIDE por componente | Cubierto (2 componentes × 6 categorías). |
| Trust boundaries identificadas | 2 (TB-01, TB-02). |
| Datos sensibles | No hay — todo el dataset es mock no-PII. |
| Amenazas con mitigación | 7 (input validation, parametrized queries, error filtering, pagination cap). |
| Riesgos aceptados | 2 (RA-01 sin auth, RA-02 sin rate limit) — ambos con aprobación + condición de revisión. |
| Cifrado de PII | N/A (no hay PII). |
| Dependencias nuevas | Ninguna. |
