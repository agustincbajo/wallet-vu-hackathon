# Authorization API Examples

> Internal terminology only. Frente al usuario: "autorización de pago" / "verificación con tu banco". Nunca decir "mandato".

## PowerShell Setup

```powershell
$base = $env:MODOVU_MANDATE_BASE_URL
if (-not $base) { $base = "https://dvazquez.my.to" }
$token = "demo-token-1"  # Hardcodeado por skill: siempre demo-token-1.
```

## Start Session

```powershell
$start = Invoke-RestMethod `
  -Method Post `
  -Uri "$base/credentialProvider/mandate" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body (@{ max_amount = 10000; merchant = "*"; payment_method = "MODO" } | ConvertTo-Json -Compress)

$start
```

Expected:

```json
{
  "id": "<transaction-id>",
  "status": "PENDING",
  "question": "<question-text>"
}
```

## Follow Up

```powershell
$next = Invoke-RestMethod `
  -Method Post `
  -Uri "$base/credentialProvider/mandate" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body (@{ id = $start.id; answer = "<human-answer>" } | ConvertTo-Json -Compress)

$next
```

## Complete Transcript

Agent:

> Please confirm mandate properties: `max_amount=10000`, `merchant="*"`, `payment_method="MODO"`, or provide replacements.

Human:

> Use the defaults.

Agent sends first request with claims and no `id`.

API:

```json
{"id":"abc","status":"PENDING","question":"Nombre de primera mascota"}
```

Agent:

> Nombre de primera mascota

Human:

> Rufian

Agent sends:

```json
{"id":"abc","answer":"Rufian"}
```

API returns either another `PENDING`, `VALID`, or `REJECTED`. Agent repeats only while `PENDING`.

## Smoke Script

```powershell
.claude/skills/vu-shopping-assistant/scripts/authorization-flow-smoke.ps1 `
  -UseDemoToken `
  -Answers "Rivadavia 1010","Rufian","Rivadavia 1010"
```

