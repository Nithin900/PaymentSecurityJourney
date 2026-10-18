<#
Shows what happens INSIDE each service for one payment: the Spring Security filter chain, JWT
validation, the authorization decision, controller -> service -> repository calls (request.flow,
with timings), the SQL, and the calls to the next service. Same trace id across all of them.
Needs the services started with the httptrace profile (it turns on Spring Security TRACE):
  $env:SPRING_PROFILES_ACTIVE = "dev,local,httptrace"; .\scripts\start-all.ps1
Usage:  .\scripts\trace-token.ps1       # logs in, leaves the token in LAST_TOKEN
        .\scripts\show-internals.ps1    # or  -Token <jwt>   or  -Full  for every raw log line
#>
param([string]$Token = $env:LAST_TOKEN, [switch]$Full)

if (-not $Token) { Write-Host "No token: run .\scripts\trace-token.ps1 first, or pass -Token <jwt>." -ForegroundColor Red; exit 1 }
$id = "INT-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
Invoke-RestMethod -Method Post http://localhost:8080/payments -Headers @{ Authorization = "Bearer $Token" } -ContentType "application/json" `
    -Body "{""paymentId"":""$id"",""accountNumber"":""acc-123"",""amount"":3.00}" | Out-Null
Write-Host "Sent payment $id. Collecting the logs (the e-mail takes 10-30 s)..." -ForegroundColor DarkGray

$logDir = Join-Path $PSScriptRoot "logs"
$names = "payment-service-a", "payment-service-b", "NotificationService"
for ($i = 0; $i -lt 25; $i++) {
    if (Select-String -Path (Join-Path $logDir "NotificationService.log") -Pattern "Notification sent for payment $id", "Could not send notification for payment $id" -ErrorAction SilentlyContinue) { break }
    Start-Sleep -Seconds 2
}
$hit = $names | ForEach-Object { Select-String -Path (Join-Path $logDir "$_.log") -Pattern $id -SimpleMatch -ErrorAction SilentlyContinue } | Select-Object -First 1
$tid = if ($hit) { [regex]::Match($hit.Line, '\[([0-9a-f]{16,32})\]').Groups[1].Value } else { "" }
if (-not $tid) { Write-Host "No trace id found for $id in $logDir." -ForegroundColor Red; exit 1 }

# What each kind of line means, so the output reads as a story
function Classify([string]$l) {
    if ($l -match 'Invoking (\w+) \(\d+/\d+\)')                 { return "FILTER" }
    if ($l -match 'request\.flow')                              { return "CALL" }
    if ($l -match 'org\.hibernate\.SQL')                        { return "SQL" }
    if ($l -match 'Jwt|BearerToken|JwtAuthentication')          { return "JWT" }
    if ($l -match 'Authorized|AuthorizationFilter|Secured|Set SecurityContextHolder|Did not set|Authenticated') { return "AUTH" }
    if ($l -match 'ExchangeFunctions|NotificationListener|Notification sent|EmailNotification') { return "OUT" }
    if ($l -match 'DispatcherServlet|Completed|Mapped to')      { return "MVC" }
    return $null
}
$color = @{ FILTER = "DarkGray"; JWT = "Magenta"; AUTH = "Yellow"; MVC = "Cyan"; CALL = "Green"; SQL = "Blue"; OUT = "White" }

foreach ($n in $names) {
    Write-Host "`n================ $n  (trace $tid) ================" -ForegroundColor Cyan
    $lines = Get-Content (Join-Path $logDir "$n.log") | Where-Object { $_ -match [regex]::Escape($tid) }
    if ($Full) { $lines; continue }
    $filters = @()
    foreach ($l in $lines) {
        $short = ($l -replace '^\S+\s+(\w+)\s+\d+ --- \[[^\]]*\] \[[^\]]*\] \[[0-9a-f]*\] ', '$1 ')
        $k = Classify $l
        if ($k -eq "FILTER") { $filters += [regex]::Match($l, 'Invoking (\w+)').Groups[1].Value; continue }
        if ($filters) { Write-Host ("  FILTER  chain ran: " + ($filters -join " > ")) -ForegroundColor $color.FILTER; $filters = @() }
        if ($k) { Write-Host ("  {0,-6}  {1}" -f $k, $short.Substring(0, [Math]::Min(170, $short.Length))) -ForegroundColor $color[$k] }
    }
    if ($filters) { Write-Host ("  FILTER  chain ran: " + ($filters -join " > ")) -ForegroundColor $color.FILTER }
}
Write-Host "`nLegend: FILTER security chain | JWT token decode/verify | AUTH who is allowed | MVC controller routing | CALL controller>service>repository | SQL queries | OUT next hop / e-mail" -ForegroundColor DarkGray
Write-Host "Add -Full for every raw line of the trace (Spring Security TRACE is very detailed)." -ForegroundColor DarkGray
