<#
Gets a token (you paste the auth code from the browser login) and creates one payment
through A -> B -> Notification, which triggers the email. Needs start-all.ps1 running.
Usage:  .\scripts\send-test-payment.ps1
#>

$ErrorActionPreference = "Stop"
$authorizeUrl = "http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https://oauth.pstmn.io/v1/callback"
Write-Host ""
Write-Host "Get the auth code:" -ForegroundColor Cyan
Write-Host "  1. Log in as nithin / password at the link below (opening it for you), click Approve."
Write-Host "  2. The browser lands on oauth.pstmn.io (it may say 'can't be reached', that is fine)."
Write-Host "  3. Copy the value after  code=  from the address bar (you may paste the whole address)."
Start-Process $authorizeUrl
$in = (Read-Host "`nPaste the auth code").Trim()
if (-not $in) { exit 0 }

$m = [regex]::Match($in, '[?&]code=([^&\s]+)')
$code = if ($m.Success) { $m.Groups[1].Value } else { $in }
$cred = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("payment-client:secret"))
try {
    $tok = (Invoke-RestMethod -Method Post http://localhost:9000/oauth2/token -Headers @{ Authorization = "Basic $cred" } `
        -Body @{ grant_type = "authorization_code"; code = $code; redirect_uri = "https://oauth.pstmn.io/v1/callback" }).access_token
} catch {
    Write-Host "Token exchange failed. The code is single-use and expires within minutes; run this script again and paste a fresh one." -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
Write-Host "Got a token for nithin." -ForegroundColor Green

$amountIn = (Read-Host "Amount for a test payment (e.g. 25.50, Enter to cancel)").Trim()
if (-not $amountIn) { exit 0 }
$amount = 0.0
if (-not [decimal]::TryParse($amountIn, [Globalization.NumberStyles]::Number, [Globalization.CultureInfo]::InvariantCulture, [ref]$amount) -or $amount -le 0) {
    Write-Host "Amount must be a number greater than 0 (use a dot, like 25.50)." -ForegroundColor Red; exit 1
}
$account = (Read-Host "Account number [acc-123]").Trim()
if (-not $account) { $account = "acc-123" }
$id = "PS-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
try {
    Invoke-RestMethod -Method Post http://localhost:8080/payments -Headers @{ Authorization = "Bearer $tok" } -ContentType "application/json" `
        -Body "{""paymentId"":""$id"",""accountNumber"":""$account"",""amount"":$($amount.ToString([Globalization.CultureInfo]::InvariantCulture))}" | Out-Null
    Write-Host "Payment $id created. Email result: Select-String scripts\logs\NotificationService.log -Pattern $id" -ForegroundColor Green
} catch {
    Write-Host "Creating the payment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

