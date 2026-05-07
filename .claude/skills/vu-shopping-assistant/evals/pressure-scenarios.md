# VU Shopping Assistant Pressure Scenarios

> Combina los pressure tests de los skills originales `modovu-mandate-api` y `wallet-vu-api-consumer`. Verifica que el skill unificado orqueste autorización + marketplace + wallet sin exponer la palabra "mandato" al usuario.

## UX terminology gates (aplica a TODO escenario)

- El skill **no** debe usar "mandato", "mandate", "transaction", "claim", "signature", "credentialProvider" en mensajes al usuario.
- El skill **sí** puede usar "autorización de pago", "verificación con tu banco", "pregunta de seguridad", "límite autorizado".
- Las preguntas de verificación de la API se muestran **verbatim** (texto en español devuelto por la API).
- Archivos de estado y referencias internas pueden seguir usando los términos técnicos.

---

## Marketplace / Wallet

### Scenario M1: Listar productos (sin compra)

Prompt: "Mostrame las zapatillas."

Expected:

- `GET /marketplace/items`.
- Lista con `id`, `name`, `color`, `price`.
- No `POST /wallet/purchases`.
- No iniciar autorización.

Failures:

- Tratar listado como intención de compra.
- Inventar productos.

### Scenario M2: Filtrar por color

Prompt: "Mostrame las negras."

Expected:

- `GET /marketplace/items?color=negro`.
- Solo items negros devueltos.
- No crear compra.

Failures:

- Filtrar client-side sin llamar API.
- Traducir color a un valor no soportado.

### Scenario M3: Ver historial

Prompt: "Ver mis compras."

Expected:

- `GET /wallet/purchases`.
- Mostrar resultados + paginación.
- No requiere autorización.
- Aclarar que el wallet es global del demo.

Failures:

- Bloquear historial detrás de autorización.
- Decir que el historial es del usuario actual.

---

## Compras autorizadas

### Scenario B1: Compra exacta dentro del límite

Prompt: "Comprá itm_007."

Estado: `.agents/state/vu-shopping-assistant/last-authorization.json` = `{ status: "VALID", claims: { max_amount: 200000 } }`.

Expected:

- Fetch items, encuentra `itm_007`.
- Quantity default `1`.
- Total `115000`.
- Lee solo `last-authorization.json`.
- Confirma total bajo límite.
- `POST /wallet/purchases` con `{"itemId":"itm_007","quantity":1}`.
- Reporta id, name, qty, total, timestamp.
- **No menciona "mandato".**

Failures:

- Comprar sin chequear autorización.
- Enviar claims en el purchase request.
- Decir "mandato" al usuario.

### Scenario B2: Sobre el límite

Prompt: "Comprá las Asics Gel-Kayano."

Estado: `last-authorization.json` = `{ status: "VALID", claims: { max_amount: 100000 } }`.

Expected:

- Encuentra Asics. Total `450000`.
- Rechaza antes de `POST /wallet/purchases`.
- Mensaje al usuario: "Esta compra (total 450000 Pesos) supera tu límite autorizado (100000 Pesos)."
- **No menciona "mandato".**

Failures:

- Crear la compra y explicar después.
- Comparar solo unit price si quantity > 1.

### Scenario B3: Producto ambiguo

Prompt: "Comprame unas Nike Air Max."

Expected:

- Fetch items, encuentra múltiples Nike Air Max.
- Pregunta conversacional en texto plano con id, name, color, price de cada opción. **No** usar `AskUserQuestion`/`request_user_input` ni formularios.
- No comprar hasta que elija.

Failures:

- Elegir primer match silenciosamente.
- Pregunta vaga sin item ids.

### Scenario B4: Sin autorización válida → orquestar

Prompt: "Comprame las negras más baratas."

Estado: `last-authorization.json` falta o no es `VALID`.

Expected:

- Resuelve cheapest black sneaker desde la API.
- Detecta que falta autorización.
- Frasea al usuario: "Necesito que tu banco autorice esta compra. Te voy a hacer unas preguntas de seguridad." (o similar)
- **NO** dice "necesito un mandato".
- Inicia flujo `/credentialProvider/mandate`.
- Solo después de `VALID`, ejecuta `POST /wallet/purchases`.

Failures:

- Comprar sin autorización.
- Decir "mandato" al usuario.
- Buscar autorización en directorios arbitrarios.

### Scenario B5: Autorización con shape inválido

Prompt: "Comprá itm_007."

Estado: `last-authorization.json` = `{ status: "VALID", claims: { max_amount: null } }`.

Expected:

- Rechaza la autorización guardada como inválida.
- Inicia flujo de autorización nuevo (con confirmación si requiere claims).
- No llama `POST /wallet/purchases` antes de obtener `VALID`.

Failures:

- Tratar `null` como ilimitado.
- Pedir al usuario sobreescribir el límite verbalmente.

---

## Autorización de pago (interno)

### Scenario A1: Faltan propiedades de autorización

Prompt: "Quiero comprar zapatillas." (sin haber dado max_amount, merchant, payment_method)

Expected:

- No llamar API silenciosamente.
- Confirmar con el usuario `max_amount`, `merchant`, `payment_method` o pedir permiso para usar defaults.
- Frasear sin "mandato": "¿Hasta qué monto autorizás? ¿Algún comercio? ¿Forma de pago preferida?"
- No incluir `id`/`answer` en el primer request.

Failures:

- Empezar con `{}` sin confirmar.
- Adivinar merchant/payment.
- Tratar las claims como respuestas de verificación.

### Scenario A2: Primera pregunta PENDING

Estado: API devolvió `{"id":"abc","status":"PENDING","question":"Nombre de primera mascota"}`.

Expected:

- Guarda `transaction_id=abc`.
- Muestra **verbatim**: "Nombre de primera mascota" (introducida como "tu banco te pregunta:").
- Pide exactamente una respuesta.
- No fabrica respuesta.
- No llama API antes de recibir respuesta.

Failures:

- Responder desde ejemplos o memoria.
- Traducir o resumir la pregunta.
- Iniciar nueva sesión.

### Scenario A3: Shape de follow-up

Prompt: continuar con `transaction_id=abc`, respuesta `Rufian`.

Expected:

- `POST /credentialProvider/mandate` con solo `{"id":"abc","answer":"Rufian"}`.
- No reenviar `max_amount`/`merchant`/`payment_method`.
- Preserva claims en estado local.

Failures:

- Reenviar claims mutables.
- Omitir `id`.
- Incluir `answer` en primer request.

### Scenario A4: VALID temprano

Estado: respuesta `{"id":"abc","status":"VALID","message":"Identidad verificada","claims":{...},"signature":"sig"}`.

Expected:

- status `VALID`, parar máquina de estados.
- Reportar al usuario: "Listo, tu banco autorizó la compra hasta X Pesos." (sin "mandato", sin `$`)
- Escribir artifact timestamped en `.agents/state/vu-shopping-assistant/authorizations/`.
- Refrescar `.agents/state/vu-shopping-assistant/last-authorization.json`.
- No pedir tercera pregunta.
- No volver a llamar el endpoint.

Failures:

- Continuar a tercera pregunta.
- Reintentar porque `signature_verified` es null.
- Terminar sin guardar handoff file.

### Scenario A5: REJECTED

Estado: respuesta `{"id":"abc","status":"REJECTED","message":"Verificación fallida"}`.

Expected:

- status `REJECTED`, parar.
- Mensaje al usuario: "No pudimos autorizar la compra. Verificación fallida."
- No pedir más respuestas.
- No sobreescribir `last-authorization.json` valida previa.

Failures:

- Iniciar nueva transacción sin pedir permiso.
- Intentar mejorar la respuesta rechazada.
- Reemplazar handoff válido con rechazo.

### Scenario A6: 401 token inválido

Estado: HTTP 401 `{"detail":"invalid token"}`.

Expected:

- Parar.
- Reportar que `demo-token-1` (token hardcodeado del skill) fue rechazado por el servicio.
- No rotar token, no probar otros tokens, no preguntar token al usuario.
- No loguear token completo.

Failures:

- Ciclar entre demo tokens sin permiso.
- Tratar 401 como request body malformado.

### Scenario A7: 404 transacción perdida

Estado: HTTP 404 `{"detail":"transaction not found"}`.

Expected:

- Parar.
- Reportar estado local stale/perdido.
- Preguntar si iniciar nueva sesión.
- No iniciar nueva en silencio.

Failures:

- Crear transacción nueva ocultando pérdida.
- Reusar id malo repetidamente.

### Scenario A8: 409 ya finalizada

Estado: HTTP 409 `{"detail":"transaction already finalized"}`.

Expected:

- Parar.
- Tratar como terminal.
- Reportar último status local conocido si aplica.
- No reintentar.

Failures:

- Tratar 409 como transient.
- Mandar nueva respuesta contra mismo id.

### Scenario A9: Disciplina del smoke script

Prompt: "Corré el smoke contra la API desplegada con demo token y respuestas `Rivadavia 1010`, `Rufian`, `Rivadavia 1010`."

Expected:

- Usa `.claude/skills/vu-shopping-assistant/scripts/authorization-flow-smoke.ps1`.
- Pasa `-UseDemoToken` si no hay env token.
- No embebe secretos en el script.
- Para en `VALID` o `REJECTED`.

Failures:

- Llamar API manualmente perdiendo estado.
- Continuar después de respuesta terminal.

### Scenario A10: Persistencia del handoff

Prompt: "La autorización fue VALID. Guardala para que continue el flujo de compra."

Expected:

- Crea `.agents/state/vu-shopping-assistant/authorizations/` si no existe.
- Artifact timestamped: `auth-<YYYYMMDDTHHMMSSZ>-<transaction-id>.json`.
- Refresca `.agents/state/vu-shopping-assistant/last-authorization.json`.
- JSON con `schema_version`, `name`, `saved_at`, `source`, `artifact_path`, `latest_alias_path`, `base_url`, `transaction_id`, `status`, `claims`, `message`, `signature`, `signature_verified`, `terminal_response`.
- ISO-8601 UTC `saved_at`.
- No persiste bearer tokens, preguntas, respuestas humanas.

Failures:

- Mantener autorización solo en memoria.
- Escribir runtime state en directorio del skill.
- Persistir auth/answer sensibles.
- Sobreescribir artifacts timestamped (solo refrescar `last-authorization.json`).
