# PRD: Listar compras del wallet (GET /wallet/purchases)

| Métrica | Valor |
|---------|-------|
| Ticket | FEAT-001 |
| Jira | sin ticket |
| Fecha | 2026-05-06 |
| Loops PRD | 0 |

## Contexto y Problema

Hoy el módulo `wallet` solo expone `POST /wallet/purchases` para registrar una compra. No existe forma de consultar las compras realizadas. Para una demo de hackathon que muestra el flujo end-to-end (browse marketplace → comprar → ver historial), falta el endpoint de lectura. Sin él, el frontend / consumidor no puede mostrar historial ni confirmar que la compra quedó persistida.

## Objetivos

- Exponer un endpoint público que devuelva las compras registradas en el wallet, ordenadas de la más reciente a la más antigua.
- Permitir paginación para soportar listados grandes sin cargar toda la tabla.
- Permitir un filtrado básico por `itemId` para que el consumidor pueda ver compras de un producto específico.
- Mantener consistencia con el resto del API (DTOs, manejo de errores, telemetría snake_case).

## Requerimientos Funcionales

- **RF-01**: Exponer `GET /wallet/purchases` que devuelva el listado de compras persistidas en `PurchaseRepository`.
- **RF-02**: El orden por defecto es por `createdAt` descendente (más reciente primero).
- **RF-03**: Aceptar query params de paginación: `page` (entero ≥ 1, default 1) y `limit` (entero entre 1 y 100, default 20).
- **RF-04**: Aceptar query param de filtro opcional: `itemId` (string, match exacto). Si se omite, no filtra.
- **RF-05**: Responder con un objeto que contenga `data` (array de compras) y `pagination` (`{ page, limit, total, totalPages }`).
- **RF-06**: Cada compra del array reusa el shape ya definido en `PurchaseOutputDto`: `id`, `itemId`, `itemName`, `quantity`, `totalAmount`, `createdAt`.
- **RF-07**: Si los query params son inválidos (`page < 1`, `limit < 1`, `limit > 100`, tipos no numéricos), responder `400 Bad Request` con detalles de validación de `class-validator`.
- **RF-08**: Si `itemId` se provee pero no matchea ninguna compra, responder `200 OK` con `data: []` y `pagination` consistente (total = 0, totalPages = 0).
- **RF-09**: Si no hay compras registradas, responder `200 OK` con `data: []` y `pagination` consistente.

## Requerimientos No Funcionales

- **RNF-01**: Latencia p95 < 200 ms para el dataset esperado (≤ 10.000 compras seed/in-memory). En SQLite in-memory esto es trivial; el RNF aplica a integraciones futuras.
- **RNF-02**: Logs estructurados JSON con `snake_case` (consistente con `ModoLogger`), incluyendo `trace_id` propagado por el middleware existente.
- **RNF-03**: Validación de query params via `class-validator` en un DTO dedicado (`PurchaseListInputDto` o equivalente).
- **RNF-04**: Mapping DB → entidad → DTO mantenido (no exponer el `Model` de TypeORM directamente).
- **RNF-05**: Cobertura unit + e2e: al menos un test e2e por AC y unit tests para la rama de servicio que arma la query/paginación.

## Criterios de Aceptación

- **AC-01**: Dado 0 compras registradas, cuando se hace `GET /wallet/purchases`, entonces responde `200` con `{ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }`.
- **AC-02**: Dado 25 compras registradas, cuando se hace `GET /wallet/purchases`, entonces responde `200` con `data.length === 20`, `pagination.total === 25`, `pagination.page === 1`, `pagination.totalPages === 2`.
- **AC-03**: Dado 25 compras registradas, cuando se hace `GET /wallet/purchases?page=2&limit=20`, entonces responde `200` con `data.length === 5`, `pagination.page === 2`.
- **AC-04**: Dado compras P1 (createdAt = T1) y P2 (createdAt = T2 > T1), cuando se hace `GET /wallet/purchases`, entonces `data[0].id === P2.id` y `data[1].id === P1.id`.
- **AC-05**: Dado compras de `itm_001` y `itm_002`, cuando se hace `GET /wallet/purchases?itemId=itm_001`, entonces `data` contiene solo compras con `itemId === "itm_001"` y `pagination.total` refleja únicamente ese subconjunto.
- **AC-06**: Dado `GET /wallet/purchases?page=0`, entonces responde `400` con mensaje de validación indicando que `page` debe ser ≥ 1.
- **AC-07**: Dado `GET /wallet/purchases?limit=200`, entonces responde `400` con mensaje de validación indicando que `limit` debe ser ≤ 100.
- **AC-08**: Dado `GET /wallet/purchases?itemId=no_existe`, entonces responde `200` con `data: []` y `pagination.total === 0`.
- **AC-09**: La respuesta de cada compra contiene exactamente los campos `id`, `itemId`, `itemName`, `quantity`, `totalAmount`, `createdAt` (mismo shape que `PurchaseOutputDto`).

## Fuera de Alcance

- Autenticación / autorización / scoping por usuario (la API es mock sin auth — devolvemos compras globales).
- Filtros por rango de fechas (`from`, `to`).
- Filtros por monto (`minAmount`, `maxAmount`).
- Búsqueda full-text por `itemName`.
- Ordenamiento configurable (`sortBy`, `sortOrder`). El orden es fijo: `createdAt DESC`.
- Cursor-based pagination (usamos page/limit clásico).
- Caching, rate limiting, ETags.
- Endpoint para una compra individual (`GET /wallet/purchases/:id`).

## Riesgos y Mitigaciones

- **R-01**: `limit` muy alto puede impactar memoria si la tabla crece → mitigado con cap `limit ≤ 100` validado en el DTO.
- **R-02**: Inconsistencia entre `total` y `data` si hay escrituras concurrentes durante la query → aceptable para hackathon (best effort, sin transacción serializable).
- **R-03**: Romper consumidores existentes del POST si compartimos demasiado código → mitigado: nuevo método de servicio + DTO dedicado, no se toca el path actual.

## Dependencias

- Módulo `wallet` existente: `WalletService`, `PurchaseRepository`, `PurchaseModel`, `PurchaseEntity`, `PurchaseOutputDto`.
- TypeORM 0.3 (paginación con `findAndCount` + `skip`/`take`).
- `class-validator` + `class-transformer` (validación del DTO de query).
- Middleware de `TraceContext` y `ModoLogger` (ya activos globalmente).
- Sin nuevos paquetes ni nuevos módulos.
