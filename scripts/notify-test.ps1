<#
Interactive email test. Asks for:
  - sender Gmail and its App Password
  - recipient Gmail
  - the auth code (you get it from the browser login)
Then it restarts ONLY the NotificationService with those mail settings, exchanges the
code for a token, creates a payment through Service A (A -> B -> Notification -> Gmail)
and tells you what happened. No Spring Boot change is needed: the service already reads
MAIL_USERNAME, MAIL_PASSWORD and NOTIFICATION_RECIPIENT from the environment.

Needs the other services running (scripts\start-all.ps1). Nothing is saved to disk.
Usage:  .\scripts\notify-test.ps1
#>

Add-Type -AssemblyName System.Net.Http
$ErrorActionPreference = "Stop"
$root   = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $PSScriptRoot "logs"
$redirect = "https://oauth.pstmn.io/v1/callback"

function Test-Port($port) { [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) }

# ---- 1. the other services must be up ----
foreach ($p in @(@(9000, "auth server"), @(8081, "service B"), @(8080, "service A"))) {
    if (-not (Test-Port $p[0])) {
        Write-Host "$($p[1]) (port $($p[0])) is not running. Run .\scripts\start-all.ps1 first." -ForegroundColor Red
        exit 1
    }
}

# ---- 2. ask for the auth code, then turn it into a token (first, it expires fast) ----
$authorize = "http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=$redirect"
Write-Host ""
Write-Host "Get the auth code:" -ForegroundColor Cyan
Write-Host "  1. Open this link (opening it for you now):"
Write-Host "     $authorize"
Write-Host "  2. Log in as nithin / password, click Approve."
Write-Host "  3. The browser lands on a page at oauth.pstmn.io (it may say 'can't be reached', that is fine)."
Write-Host "     Copy the value after  code=  from the address bar (you may paste the whole address)."
Start-Process $authorize

$in = (Read-Host "`nPaste the auth code").Trim()
$m = [regex]::Match($in, '[?&]code=([^&\s]+)')
$code = if ($m.Success) { $m.Groups[1].Value } else { $in }

# (code -> token)
$cred = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("payment-client:secret"))
try {
    $tok = (Invoke-RestMethod -Method Post http://localhost:9000/oauth2/token -Headers @{ Authorization = "Basic $cred" } `
        -Body @{ grant_type = "authorization_code"; code = $code; redirect_uri = $redirect }).access_token
} catch {
    Write-Host "Token exchange failed. The code is single-use and expires within minutes; run the script again and paste a fresh one." -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
Write-Host "Got a token." -ForegroundColor Green

# ---- 3. ask for the mail settings ----
Write-Host ""
Write-Host "Mail settings (used only for this run, never written to a file)" -ForegroundColor Cyan
$sender = (Read-Host "Sender Gmail (the account that sends, e.g. you@gmail.com)").Trim()
$secure = Read-Host "Sender App Password (16 characters, typing is hidden)" -AsSecureString
$bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$appPw  = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr).Replace(" ", "")
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$recipient = (Read-Host "Recipient Gmail (who receives the email)").Trim()

if ($sender -notmatch "^[^@\s]+@[^@\s]+$" -or $recipient -notmatch "^[^@\s]+@[^@\s]+$") {
    Write-Host "Sender and recipient must look like name@gmail.com" -ForegroundColor Red; exit 1
}
if ($appPw.Length -ne 16) {
    Write-Host "Warning: a Gmail App Password has 16 characters, yours has $($appPw.Length). Create one at https://myaccount.google.com/apppasswords" -ForegroundColor Yellow
}

# ---- 3b. ask for the payment details ----
Write-Host ""
Write-Host "Payment to create (it triggers the email)" -ForegroundColor Cyan
$amountIn = (Read-Host "Amount (e.g. 25.50)").Trim()
$amount = 0.0
if (-not [decimal]::TryParse($amountIn, [Globalization.NumberStyles]::Number, [Globalization.CultureInfo]::InvariantCulture, [ref]$amount) -or $amount -le 0) {
    Write-Host "Amount must be a number greater than 0 (use a dot, like 25.50)." -ForegroundColor Red; exit 1
}
$account = (Read-Host "Account number [acc-123]").Trim()
if (-not $account) { $account = "acc-123" }
$amountJson = $amount.ToString([Globalization.CultureInfo]::InvariantCulture)

# ---- 4. restart only the notification service with those settings ----
Write-Host "`nRestarting NotificationService with your mail settings..."
Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    taskkill /PID $_.OwningProcess /T /F | Out-Null
}
Start-Sleep -Seconds 2

$saved = @{ U = $env:MAIL_USERNAME; P = $env:MAIL_PASSWORD; R = $env:NOTIFICATION_RECIPIENT; S = $env:SPRING_PROFILES_ACTIVE }
$env:MAIL_USERNAME = $sender
$env:MAIL_PASSWORD = $appPw
$env:NOTIFICATION_RECIPIENT = $recipient
$env:SPRING_PROFILES_ACTIVE = "dev"      # not "local": the typed values must win over application-local.yaml

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "NotificationService.log"
$proc = Start-Process -FilePath "mvn" -ArgumentList "spring-boot:run", "-pl", "NotificationService" `
    -WorkingDirectory $root -RedirectStandardOutput $logFile -RedirectStandardError "$logFile.err" `
    -PassThru -WindowStyle Hidden

# do not leave the password in this PowerShell session
$env:MAIL_USERNAME = $saved.U; $env:MAIL_PASSWORD = $saved.P
$env:NOTIFICATION_RECIPIENT = $saved.R; $env:SPRING_PROFILES_ACTIVE = $saved.S
$appPw = $null

$up = $false
for ($i = 0; $i -lt 45; $i++) { if (Test-Port 8082) { $up = $true; break }; Start-Sleep -Seconds 2 }
if (-not $up) { Write-Host "NotificationService did not start. See $logFile and $logFile.err" -ForegroundColor Red; exit 1 }
Write-Host "NotificationService is up (PID $($proc.Id))." -ForegroundColor Green

$pidsFile = Join-Path $PSScriptRoot "pids.json"
if (Test-Path $pidsFile) {
    $pids = Get-Content $pidsFile | ConvertFrom-Json
    $pids | Add-Member -NotePropertyName "NotificationService" -NotePropertyValue $proc.Id -Force
    $pids | ConvertTo-Json | Set-Content $pidsFile
}

# ---- 6. create a payment through A -> B -> Notification ----
$id = "MAIL-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
try {
    $r = Invoke-RestMethod -Method Post http://localhost:8080/payments -Headers @{ Authorization = "Bearer $tok" } `
        -ContentType "application/json" -Body "{""paymentId"":""$id"",""accountNumber"":""$account"",""amount"":$amountJson}"
    Write-Host "Payment $id created (amount $amountJson, account $account)." -ForegroundColor Green
} catch {
    Write-Host "Creating the payment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "See README > Troubleshooting > Create payment does not return 200"
    exit 1
}

# ---- 7. what happened to the email ----
Write-Host "Waiting for the email (Gmail can take 10-40 s)..."
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    if ((Test-Path $logFile) -and ((Get-Content $logFile -Raw) -match "(Notification sent|Could not send notification) for payment $id")) { break }
}
$blog = Join-Path $logDir "payment-service-b.log"
$nlog = $logFile
$bTxt = ""; if (Test-Path $blog) { $bTxt = Get-Content $blog -Raw }
$nTxt = ""; if (Test-Path $nlog) { $nTxt = Get-Content $nlog -Raw }

Write-Host ""
if ($nTxt -match "Notification sent for payment $id") {
    Write-Host "EMAIL SENT for $id to $recipient. Check the inbox (and Spam)." -ForegroundColor Green
} elseif ($nTxt -match "Could not send notification for payment $id") {
    Write-Host "The notification service could not send the email:" -ForegroundColor Red
    if ($nTxt -match "535|AuthenticationFailed|Username and Password not accepted") {
        Write-Host "  Gmail rejected the login. Use a 16-character App Password (not your normal password) for the SENDER account." -ForegroundColor Yellow
    } elseif ($nTxt -match "Connect|timed out|UnknownHost") {
        Write-Host "  Cannot reach smtp.gmail.com:587. Test: Test-NetConnection smtp.gmail.com -Port 587" -ForegroundColor Yellow
    } else {
        Write-Host "  See the last ERROR in $nlog" -ForegroundColor Yellow
    }
} elseif ($bTxt -match "Payment $id saved, but the notification could not be sent") {
    Write-Host "Payment saved, but B could not reach the notification service (token/scope/network)." -ForegroundColor Red
    Write-Host "  See README > Troubleshooting > Notification service: 401 / 403 / 502"
} else {
    Write-Host "No result in the logs yet. Look again in a few seconds:" -ForegroundColor Yellow
    Write-Host "  Select-String $nlog -Pattern $id"
}
