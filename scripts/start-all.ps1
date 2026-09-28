<#
Starts all three services in the correct order, each as a background process,
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
    @{ Name = "payment-service-a";            Port = 8080 }
)

# Local runs use the "dev" profile unless one is already set: in-memory signing key (no keystore needed)
# and the H2 console enabled. Set SPRING_PROFILES_ACTIVE (plus KEYSTORE_PATH / KEYSTORE_PASSWORD) to override.
if (-not $env:SPRING_PROFILES_ACTIVE) { $env:SPRING_PROFILES_ACTIVE = "dev" }

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
