<#
Guided run of the whole project, PowerShell only. It checks what is already done,
tells you the next step, and runs it when you press Enter.

Steps: 1 check tools, 2 build, 3 email setup (optional), 4 start services,
       5 full test, 6 email test (optional), 7 stop.

Usage:  .\scripts\guide.ps1
#>

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($n, $title) { Write-Host ""; Write-Host "=== Step $n : $title ===" -ForegroundColor Cyan }
function Ask($q)          { $a = Read-Host "$q [Enter = yes, n = skip, q = quit]"; if ($a -eq "q") { exit 0 }; return ($a -ne "n") }
function Up($port)        { [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) }

Write-Host "Payment Security Journey: guided run" -ForegroundColor Green
Write-Host "Repo: $root"

# 1. tools
Step 1 "Check Java 17 and Maven"
$javaOk = $false; $mvnOk = $false
try { $v = (& java -version 2>&1 | Select-Object -First 1).ToString(); Write-Host "java : $v"; $javaOk = $v -match '"17' } catch { Write-Host "java not found" -ForegroundColor Red }
try { $m = (& mvn -v 2>&1 | Select-Object -First 1).ToString(); Write-Host "mvn  : $m"; $mvnOk = $true } catch { Write-Host "mvn not found" -ForegroundColor Red }
if (-not $javaOk) { Write-Host "Java 17 is required. Install it and reopen PowerShell." -ForegroundColor Red; exit 1 }
if (-not $mvnOk)  { Write-Host "Maven is required. Install it and reopen PowerShell." -ForegroundColor Red; exit 1 }

# 2. build
Step 2 "Build all modules (needed once; Service A depends on B's jar)"
$jarB = Get-ChildItem (Join-Path $root "payment-service-b\target") -Filter "*.jar" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jarB) { Write-Host "Already built ($($jarB.Name)). Rebuild only if you changed code." } else { Write-Host "Not built yet." }
if (Ask "Run 'mvn clean install -DskipTests' now?") {
    mvn clean install -DskipTests
    if ($LASTEXITCODE -ne 0) { Write-Host "Build failed. Fix the error above, then run this guide again." -ForegroundColor Red; exit 1 }
}

# 3. email setup
Step 3 "Email setup (optional)"
$local = Join-Path $root "NotificationService\src\main\resources\application-local.yaml"
if (Test-Path $local) { Write-Host "Found application-local.yaml. Emails will be sent." -ForegroundColor Green }
else {
    Write-Host "No application-local.yaml. Payments still work; only the email step fails (warning in B's log)." -ForegroundColor Yellow
    Write-Host "To enable email create: $local"
    Write-Host "  spring.mail.username / spring.mail.password (Gmail App Password), notification.from, notification.recipient"
    Write-Host "Or just type the Gmail details when start-all.ps1 asks; they are not saved."
}

# 4. start
Step 4 "Start the four services (auth 9000, B 8081, A 8080, notification 8082)"
$ports = 9000, 8081, 8080, 8082
$running = $ports | Where-Object { Up $_ }
if ($running.Count -eq 4) { Write-Host "All four are already running." -ForegroundColor Green }
else {
    if ($running.Count -gt 0) { Write-Host "Ports already in use: $($running -join ', '). Run .\scripts\stop-all.ps1 first if start fails." -ForegroundColor Yellow }
    if (Ask "Run start-all.ps1 now?") { & (Join-Path $PSScriptRoot "start-all.ps1") }
}

# 5. test
Step 5 "Run the full test (real login, tokens, 25+ checks)"
if ((($ports | Where-Object { Up $_ }).Count) -lt 4) { Write-Host "Not all services are up, so the test would fail. Check scripts\logs\*.log" -ForegroundColor Red }
elseif (Ask "Run test-all.ps1 now?") { & (Join-Path $PSScriptRoot "test-all.ps1") }

# 6. email test
Step 6 "Send a test payment (optional)"
Write-Host "Asks for an auth code, then creates a payment and the email goes out."
if (Ask "Run send-test-payment.ps1 now?") { & (Join-Path $PSScriptRoot "send-test-payment.ps1") }

# 7. stop
Step 7 "Stop everything"
if (Ask "Run stop-all.ps1 now? (n keeps the services running)") { & (Join-Path $PSScriptRoot "stop-all.ps1") }
else {
    Write-Host ""
    Write-Host "Services keep running. Useful links:" -ForegroundColor Green
    Write-Host "  Login/authorize : http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https://oauth.pstmn.io/v1/callback"
    Write-Host "  Logs            : scripts\logs\<module>.log"
    Write-Host "  Stop later      : .\scripts\stop-all.ps1"
}
Write-Host ""
Write-Host "Done." -ForegroundColor Green
