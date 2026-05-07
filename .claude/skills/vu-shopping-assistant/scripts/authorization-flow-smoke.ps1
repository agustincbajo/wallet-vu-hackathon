param(
    [string] $BaseUrl = $env:MODOVU_MANDATE_BASE_URL,
    [string] $Token = $env:MODOVU_MANDATE_TOKEN,
    [switch] $UseDemoToken,
    [switch] $UseLocalBaseUrl,
    [string[]] $Answers = @(),
    [object] $MaxAmount = 10000,
    [string] $Merchant = "*",
    [string] $PaymentMethod = "MODO"
)

$ErrorActionPreference = "Stop"

if ($UseLocalBaseUrl) {
    $BaseUrl = "http://localhost:8080"
}
elseif ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = "https://dvazquez.my.to"
}

if ([string]::IsNullOrWhiteSpace($Token)) {
    if ($UseDemoToken) {
        $Token = "demo-token-1"
    }
    else {
        Write-Error "MODOVU_MANDATE_TOKEN is not set. Pass -UseDemoToken for demo execution or provide -Token."
    }
}

if ($Answers.Count -eq 0) {
    Write-Error "Provide at least one answer with -Answers. Answers are never embedded in this script."
}

function Invoke-MandateRequest {
    param(
        [hashtable] $Body
    )

    $uri = "$BaseUrl/credentialProvider/mandate"
    $headers = @{ Authorization = "Bearer $Token" }
    $json = $Body | ConvertTo-Json -Compress

    try {
        return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body $json
    }
    catch {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            $statusCode = [int] $response.StatusCode
            $stream = $response.GetResponseStream()
            $reader = [System.IO.StreamReader]::new($stream)
            $bodyText = $reader.ReadToEnd()
            Write-Error "Mandate API returned HTTP ${statusCode}: $bodyText"
        }
        Write-Error $_
    }
}

function Assert-ResponseShape {
    param(
        [object] $Response
    )

    if ($null -eq $Response.id -or [string]::IsNullOrWhiteSpace([string] $Response.status)) {
        Write-Error "Malformed response: missing id or status. Response: $($Response | ConvertTo-Json -Compress)"
    }

    if ($Response.status -notin @("PENDING", "VALID", "REJECTED")) {
        Write-Error "Malformed response: unknown status '$($Response.status)'."
    }
}

function Save-LastAuthorization {
    param(
        [object] $Response,
        [string] $ResolvedBaseUrl
    )

    $workspaceAgentsDir = Join-Path (Get-Location).Path ".agents"
    if (Test-Path -LiteralPath $workspaceAgentsDir) {
        $agentsDir = $workspaceAgentsDir
    }
    else {
        $skillDir = Split-Path -Parent $PSScriptRoot
        $skillsDir = Split-Path -Parent $skillDir
        $agentsDir = Split-Path -Parent $skillsDir
    }
    $stateDir = Join-Path $agentsDir "state/vu-shopping-assistant"
    $authorizationsDir = Join-Path $stateDir "authorizations"
    $latestPath = Join-Path $stateDir "last-authorization.json"

    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    New-Item -ItemType Directory -Force -Path $authorizationsDir | Out-Null

    $savedAt = (Get-Date).ToUniversalTime()
    $timestampForName = $savedAt.ToString("yyyyMMddTHHmmssZ")
    $safeTransactionId = ([string] $Response.id) -replace "[^A-Za-z0-9._-]", "-"
    $authorizationName = "auth-$timestampForName-$safeTransactionId"
    $artifactPath = Join-Path $authorizationsDir "$authorizationName.json"
    $artifactRelativePath = ".agents/state/vu-shopping-assistant/authorizations/$authorizationName.json"
    $latestRelativePath = ".agents/state/vu-shopping-assistant/last-authorization.json"

    $handoff = [ordered] @{
        schema_version = 1
        name = $authorizationName
        saved_at = $savedAt.ToString("yyyy-MM-ddTHH:mm:ssZ")
        source = "vu-shopping-assistant"
        artifact_path = $artifactRelativePath
        latest_alias_path = $latestRelativePath
        base_url = $ResolvedBaseUrl
        transaction_id = $Response.id
        status = $Response.status
        claims = $Response.claims
        message = $Response.message
        signature = $Response.signature
        signature_verified = $null
        terminal_response = $Response
    }

    $json = $handoff | ConvertTo-Json -Depth 20
    $json | Set-Content -Path $artifactPath -Encoding UTF8
    $json | Set-Content -Path $latestPath -Encoding UTF8
    return $latestPath
}

$claimsBody = @{
    max_amount = $MaxAmount
    merchant = $Merchant
    payment_method = $PaymentMethod
}

Write-Host "Starting authorization session at $BaseUrl"
$response = Invoke-MandateRequest -Body $claimsBody
Assert-ResponseShape -Response $response
Write-Host ($response | ConvertTo-Json -Compress)

$transactionId = $response.id
$answerIndex = 0

while ($response.status -eq "PENDING") {
    if ($answerIndex -ge $Answers.Count) {
        Write-Error "API requested another answer but only $($Answers.Count) answer(s) were provided. Current question: $($response.question)"
    }

    Write-Host "Question: $($response.question)"
    $answer = $Answers[$answerIndex]
    $answerIndex += 1

    $response = Invoke-MandateRequest -Body @{
        id = $transactionId
        answer = $answer
    }

    Assert-ResponseShape -Response $response
    Write-Host ($response | ConvertTo-Json -Compress)
}

if ($response.status -eq "VALID") {
    if ([string]::IsNullOrWhiteSpace([string] $response.signature)) {
        Write-Error "VALID response did not include signature."
    }
    $statePath = Save-LastAuthorization -Response $response -ResolvedBaseUrl $BaseUrl
    Write-Host "Saved last authorization: $statePath"
    Write-Host "Terminal status: VALID"
    exit 0
}

if ($response.status -eq "REJECTED") {
    Write-Host "Terminal status: REJECTED"
    exit 0
}

Write-Error "Unexpected terminal handling for status '$($response.status)'."
