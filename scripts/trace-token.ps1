<#
Shows how a token travels: decodes the JWT, sends one payment through A -> B -> Notification
with it, then prints every log line (all four services) that carries the payment's trace id,
in time order, plus B's own client_credentials token request.
Needs start-all.ps1 running. Usage:
  .\scripts\trace-token.ps1                 # asks you to log in once in the browser
  .\scripts\trace-token.ps1 -Token <jwt>    # reuse a token you already have
#>
param([string]$Token = "")

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\secrets.ps1"

function Decode-Jwt([string]$jwt) {
    $parts = $jwt.Split('.')
    $out = @{}
    foreach ($i in 0, 1) {
        $p = $parts[$i].Replace('-', '+').Replace('_', '/')
        $p += '=' * ((4 - $p.Length % 4) % 4)
        $out[$i] = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p)) | ConvertFrom-Json
    }
    return $out
}

if (-not $Token) {
    $url = "http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https://oauth.pstmn.io/v1/callback"
    Write-Host "1. LOGIN: log in at the link (opening it), click Approve, copy code= from the address bar." -ForegroundColor Cyan
    Start-Process $url
    $in = (Read-Host "Paste the auth code (or the whole address)").Trim()
    $m = [regex]::Match($in, '[?&]code=([^&\s]+)')
    $code = if ($m.Success) { $m.Groups[1].Value } else { $in }
    $cred = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("payment-client:$(Get-LocalSecret PAYMENT_CLIENT_SECRET)"))
    $Token = (Invoke-RestMethod -Method Post http://localhost:9000/oauth2/token -Headers @{ Authorization = "Basic $cred" } `
        -Body @{ grant_type = "authorization_code"; code = $code; redirect_uri = "https://oauth.pstmn.io/v1/callback" }).access_token
    Write-Host "2. TOKEN ISSUED by the auth server (POST /oauth2/token)." -ForegroundColor Cyan
}

$env:LAST_TOKEN = $Token      # so show-http.ps1 can reuse it (expires in 5 min)
$jwt = Decode-Jwt $Token
$exp = [DateTimeOffset]::FromUnixTimeSeconds([int64]$jwt[1].exp).LocalDateTime
Write-Host "`n3. INSIDE THE TOKEN" -ForegroundColor Cyan
Write-Host "   user (sub) : $($jwt[1].sub)"
Write-Host "   scopes     : $($jwt[1].scope -join ' ')"
Write-Host "   issuer     : $($jwt[1].iss)"
Write-Host "   expires    : $exp  ($([int]($exp - (Get-Date)).TotalSeconds) s left)"
Write-Host "   signed with key id $($jwt[0].kid) (services verify it with the auth server's public keys)"

$id = "TRACE-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
Write-Host "`n4. SENDING payment $id to A with  Authorization: Bearer <that token>" -ForegroundColor Cyan
Invoke-RestMethod -Method Post http://localhost:8080/payments -Headers @{ Authorization = "Bearer $Token" } -ContentType "application/json" `
    -Body "{""paymentId"":""$id"",""accountNumber"":""acc-123"",""amount"":1.00}" | Out-Null
Start-Sleep -Seconds 1

$logDir = Join-Path $PSScriptRoot "logs"
$names = "payment-authorization-server", "payment-service-a", "payment-service-b", "NotificationService"
$tag = @{ "payment-authorization-server" = "AUTH "; "payment-service-a" = "A    "; "payment-service-b" = "B    "; "NotificationService" = "NOTIF" }

# the trace id sits right after the log level, e.g.  INFO [4bf92f3577b34da6] ...
$hit = $null
for ($i = 0; $i -lt 25 -and -not $hit; $i++) {      # the id reaches the logs a moment later (B, then the e-mail)
    $hit = $names | ForEach-Object { Select-String -Path (Join-Path $logDir "$_.log") -Pattern $id -SimpleMatch -ErrorAction SilentlyContinue } | Select-Object -First 1
    if (-not $hit) { Start-Sleep -Seconds 2 }
}
$tid = if ($hit) { [regex]::Match($hit.Line, '\[([0-9a-f]{16,32})\]').Groups[1].Value } else { "" }
if (-not $tid) { Write-Host "No trace id found in the logs for $id (is tracing on and are the logs in ${logDir}?)" -ForegroundColor Red; exit 1 }

for ($i = 0; $i -lt 23; $i++) {      # the e-mail takes 10-30 s; wait for its result so the timeline is complete
    if (Select-String -Path (Join-Path $logDir "NotificationService.log") -Pattern "Notification sent for payment $id", "Could not send notification for payment $id" -ErrorAction SilentlyContinue) { break }
    Start-Sleep -Seconds 2
}

Write-Host "`n5. TIMELINE for trace $tid (A -> B -> Notification; token is validated at each hop)" -ForegroundColor Cyan
$lines = foreach ($n in $names) {
    Select-String -Path (Join-Path $logDir "$n.log") -Pattern $tid -SimpleMatch -ErrorAction SilentlyContinue |
        ForEach-Object { [pscustomobject]@{ Time = $_.Line.Substring(0, [Math]::Min(23, $_.Line.Length)); Svc = $tag[$n]; Text = $_.Line } }
}
$lines | Sort-Object Time | ForEach-Object { Write-Host ("{0} | {1}" -f $_.Svc, $_.Text) }

Write-Host "`n6. B -> NOTIFICATION uses a DIFFERENT token (client_credentials, no user). Auth server side:" -ForegroundColor Cyan
Select-String -Path (Join-Path $logDir "payment-authorization-server.log") -Pattern "client_credentials|payment-service-b" -ErrorAction SilentlyContinue |
    Select-Object -Last 3 | ForEach-Object { Write-Host "   $($_.Line.Trim())" }
