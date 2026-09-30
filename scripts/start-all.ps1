<#
Starts all four services in the correct order, each as a background process,
and waits for each to report ready before starting the next.
Logs go to scripts\logs\<module>.log. PIDs go to scripts\pids.json for stop-all.ps1.
#>

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$services = @(
    @{ Name = "payment-authorization-server"; Port = 9000 },
    @{ Name = "payment-service-b";            Port = 8081 },
    @{ Name = "payment-service-a";            Port = 8080 },
    @{ Name = "NotificationService";          Port = 8082 }
)

# Local runs use "dev,local" unless a profile is already set: dev = in-memory signing key (no keystore needed)
# and the H2 console; local = Gmail credentials for NotificationService (application-local.yaml). Set SPRING_PROFILES_ACTIVE (plus KEYSTORE_PATH / KEYSTORE_PASSWORD) to override.
if (-not $env:SPRING_PROFILES_ACTIVE) { $env:SPRING_PROFILES_ACTIVE = "dev,local" }

$pids = @{}

function Wait-ForPort($port, $timeoutSeconds = 90) {
    $elapsed = 0
    while ($elapsed -lt $timeoutSeconds) {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conn) { return $true }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    return $false
}

foreach ($svc in $services) {
    $name = $svc.Name
    $port = $svc.Port
    $logFile = Join-Path $logDir "$name.log"

    Write-Host "Starting $name (port $port)..."
    $proc = Start-Process -FilePath "mvn" `
        -ArgumentList "spring-boot:run", "-pl", $name `
        -WorkingDirectory $root `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err" `
        -PassThru -WindowStyle Hidden

    $pids[$name] = $proc.Id
    $pids | ConvertTo-Json | Set-Content -Path (Join-Path $PSScriptRoot "pids.json")   # saved early so stop-all.ps1 works even if a later service fails

    if (-not (Wait-ForPort -port $port)) {
        Write-Host "ERROR: $name did not open port $port in time. Check $logFile" -ForegroundColor Red
        exit 1
    }
    Write-Host "$name is up (PID $($proc.Id))." -ForegroundColor Green
}

$pids | ConvertTo-Json | Set-Content -Path (Join-Path $PSScriptRoot "pids.json")
Write-Host ""
Write-Host "All services running. Logs in $logDir"
Write-Host "Run scripts\stop-all.ps1 to stop them."

# Links, printed every time all services are up
$authorizeUrl = "http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https://oauth.pstmn.io/v1/callback"
Write-Host ""
Write-Host "Auth server login page : http://localhost:9000/login" -ForegroundColor Cyan
Write-Host "Get a token (authorize): $authorizeUrl" -ForegroundColor Cyan
Write-Host "Users: nithin / password, alice / password"
Write-Host "Test everything        : .\scripts\test-all.ps1"
