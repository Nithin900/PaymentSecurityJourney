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

# Client secrets and the H2 password come from user environment variables (created once, random).
. "$PSScriptRoot\secrets.ps1"
$newSecrets = Initialize-LocalSecrets
if ($newSecrets) { Write-Host "Created local secrets (saved in your user environment): $($newSecrets -join ', ')" -ForegroundColor Yellow }
if ($newSecrets -contains "H2_PASSWORD") {
    # An existing H2 file only opens with the password it was created with, so set it aside (not deleted).
    # spring-boot:run uses the module folder as working dir, so ./data is payment-service-b\data (the repo-root data\ is a leftover)
    foreach ($dataDir in (Join-Path $root "payment-service-b\data"), (Join-Path $root "data")) {
        $h2Files = Get-ChildItem $dataDir -Filter "paymentdb*" -File -ErrorAction SilentlyContinue
        if ($h2Files) {
            $bak = Join-Path $dataDir ("old-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
            New-Item -ItemType Directory -Force -Path $bak | Out-Null
            $h2Files | Move-Item -Destination $bak
            Write-Host "Moved the old H2 payments database to $bak (payments start empty)." -ForegroundColor Yellow
        }
    }
}

# The auth server keeps its users in MySQL and reads the login from DB_USER / DB_PASSWORD (default root/root).
# Check up front, so a missing password stops here and not after a 90 second wait on port 9000.
if (-not (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue)) {
    Write-Host "MySQL is not listening on port 3306. Start it first: Start-Service MySQL80 (admin PowerShell)." -ForegroundColor Red
    exit 1
}
if (-not $env:DB_PASSWORD) {
    Write-Host "DB_PASSWORD is not set, so the auth server would try the default root/root and fail with 'Access denied'." -ForegroundColor Red
    Write-Host "Set it for this window:  `$env:DB_PASSWORD = '<your MySQL root password>'" -ForegroundColor Yellow
    Write-Host "Or once for every new window:  [Environment]::SetEnvironmentVariable('DB_PASSWORD','<password>','User')  (then open a new terminal)" -ForegroundColor Yellow
    exit 1
}

# A variable that is set can still hold the wrong value (e.g. a copied "<password>" placeholder), so try a real login.
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "root" }
$mysqlExe = (Get-Command mysql -ErrorAction SilentlyContinue).Source
if (-not $mysqlExe) {
    $mysqlExe = Get-ChildItem "C:\Program Files\MySQL\MySQL Server *\bin\mysql.exe" -ErrorAction SilentlyContinue |
        Select-Object -Last 1 -ExpandProperty FullName
}
if ($mysqlExe) {
    $env:MYSQL_PWD = $env:DB_PASSWORD      # keeps the password off the command line
    try { & $mysqlExe -u $dbUser -h localhost -e "SELECT 1" 2>$null | Out-Null; $loginOk = ($LASTEXITCODE -eq 0) }
    catch { $loginOk = $false }
    finally { Remove-Item env:MYSQL_PWD -ErrorAction SilentlyContinue }
    if (-not $loginOk) {
        Write-Host "MySQL rejected the login for user '$dbUser' with the current DB_PASSWORD (length $($env:DB_PASSWORD.Length))." -ForegroundColor Red
        Write-Host "Fix the value (no <angle brackets>) and open a NEW terminal if you saved it with SetEnvironmentVariable." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "MySQL login OK (user '$dbUser')." -ForegroundColor Green
} else {
    Write-Host "mysql.exe not found, skipping the MySQL login check." -ForegroundColor Yellow
}

# Running start-all twice used to "succeed" against the old processes while the new ones died on
# "port already in use", and the logs then belonged to nobody. Refuse instead.
$busy = $services | Where-Object { Get-NetTCPConnection -LocalPort $_.Port -State Listen -ErrorAction SilentlyContinue }
if ($busy) {
    Write-Host "Already running on: $(($busy | ForEach-Object { "$($_.Name):$($_.Port)" }) -join ', ')" -ForegroundColor Red
    Write-Host "Run .\scripts\stop-all.ps1 first, then start-all.ps1 again." -ForegroundColor Red
    exit 1
}

# Mail settings for NotificationService, asked once up front (Enter = use application-local.yaml).
# Values live only in the child process environment; nothing is written to disk.
Write-Host "Mail settings for NotificationService (press Enter to use application-local.yaml)" -ForegroundColor Cyan
$sender = (Read-Host "Sender Gmail").Trim()
$mailEnv = @{}
if ($sender) {
    $secure = Read-Host "Sender App Password (16 characters, hidden)" -AsSecureString
    $bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $appPw  = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr).Replace(" ", "")
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $recipient = (Read-Host "Recipient Gmail [$sender]").Trim()
    if (-not $recipient) { $recipient = $sender }
    if ($sender -notmatch "^[^@\s]+@[^@\s]+$" -or $recipient -notmatch "^[^@\s]+@[^@\s]+$") {
        Write-Host "Sender and recipient must look like name@gmail.com" -ForegroundColor Red; exit 1
    }
    if ($appPw.Length -ne 16) {
        Write-Host "Warning: a Gmail App Password has 16 characters, yours has $($appPw.Length)." -ForegroundColor Yellow
    }
    $mailEnv = @{ MAIL_USERNAME = $sender; MAIL_PASSWORD = $appPw; NOTIFICATION_RECIPIENT = $recipient }
    $appPw = $null
}
Write-Host ""

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
    $typedMail = ($name -eq "NotificationService") -and $mailEnv.Count -gt 0
    if ($typedMail) {
        $savedProfile = $env:SPRING_PROFILES_ACTIVE
        $env:SPRING_PROFILES_ACTIVE = "dev"      # not "local": typed values must win over application-local.yaml
        foreach ($k in $mailEnv.Keys) { Set-Item "env:$k" $mailEnv[$k] }
    }
    $proc = Start-Process -FilePath "mvn" `
        -ArgumentList "spring-boot:run", "-pl", $name `
        -WorkingDirectory $root `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err" `
        -PassThru -WindowStyle Hidden

    if ($typedMail) {      # do not leave the password in this PowerShell session
        foreach ($k in $mailEnv.Keys) { Remove-Item "env:$k" }
        $env:SPRING_PROFILES_ACTIVE = $savedProfile
    }

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
Write-Host "Send a test payment    : .\scripts\send-test-payment.ps1   (asks for the auth code)"

