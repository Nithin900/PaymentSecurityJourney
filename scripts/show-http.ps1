<#
Shows how one request travels over HTTP through A -> B -> Notification.
1. The raw request/response between you and A (curl.exe -v prints the exact bytes).
2. The raw request each service RECEIVED (request line + headers, Authorization masked), in time order.
Needs the services started with the httptrace profile:
  $env:SPRING_PROFILES_ACTIVE = "dev,local,httptrace"; .\scripts\start-all.ps1
Usage: .\scripts\show-http.ps1 -Token <access token>      (get one with trace-token.ps1 or send-test-payment.ps1)
#>
param([string]$Token = $env:LAST_TOKEN)      # trace-token.ps1 leaves its token in LAST_TOKEN
if (-not $Token) { Write-Host "No token: run trace-token.ps1 first, or pass -Token <jwt>." -ForegroundColor Red; exit 1 }

$id = "HTTP-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$body = "{""paymentId"":""$id"",""accountNumber"":""acc-123"",""amount"":2.00}"
$tmp = New-TemporaryFile; Set-Content $tmp $body -NoNewline -Encoding ascii

Write-Host "=== YOU -> A  (curl -v: '>' is what you send, '<' is what comes back) ===" -ForegroundColor Cyan
curl.exe -sv -X POST http://localhost:8080/payments -H "Authorization: Bearer $Token" -H "Content-Type: application/json" --data-binary "@$tmp" 2>&1 |
    ForEach-Object { $_ -replace '(Bearer )[\w\.-]{20,}', '$1<token...>' }
Remove-Item $tmp
Start-Sleep -Seconds 1

Write-Host "`n=== WHAT EACH SERVICE RECEIVED (raw, from Tomcat's own log) ===" -ForegroundColor Cyan
$logDir = Join-Path $PSScriptRoot "logs"
$names = "payment-service-a", "payment-service-b", "NotificationService"
$hit = $null
for ($i = 0; $i -lt 25 -and -not $hit; $i++) {      # the id reaches the logs a moment later (B, then the e-mail)
    $hit = $names | ForEach-Object { Select-String -Path (Join-Path $logDir "$_.log") -Pattern $id -SimpleMatch -ErrorAction SilentlyContinue } | Select-Object -First 1
    if (-not $hit) { Start-Sleep -Seconds 2 }
}
$tid = if ($hit) { [regex]::Match($hit.Line, '\[([0-9a-f]{16,32})\]').Groups[1].Value } else { "" }
foreach ($n in $names) {
    Write-Host "`n--- $n ---" -ForegroundColor Yellow
    $lines = Get-Content (Join-Path $logDir "$n.log") -Tail 400
    $lines | Where-Object { $_ -match 'Http11InputBuffer|DispatcherServlet|ExchangeFunctions|Completed|POST|GET' -and ($tid -eq "" -or $_ -match $tid -or $_ -match 'Http11InputBuffer') } |
        Select-Object -Last 14 | ForEach-Object { $_ -replace '(Bearer )[\w\.-]{20,}', '$1<token...>' }
}
Write-Host "`nIf a service shows nothing, it was not started with the httptrace profile." -ForegroundColor DarkGray
