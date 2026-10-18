<#
Tests POST /register and the form login against the auth server (http://localhost:9000).
Needs the auth server running (and MySQL up). Creates users with a unique name per run.
POST /register is admin-only: calls use Basic auth as the seeded admin (ADMIN_USERNAME, default
"admin", and ADMIN_PASSWORD from your user environment; start-all.ps1 creates it).
Usage:  .\scripts\test-register.ps1
        .\scripts\test-register.ps1 -BaseUrl http://localhost:9000
Exit code is 0 when every check passes, 1 otherwise.
#>
param([string]$BaseUrl = "http://localhost:9000")

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\secrets.ps1"
$adminUser = if ($env:ADMIN_USERNAME) { $env:ADMIN_USERNAME } else { "admin" }
$adminPass = Get-LocalSecret "ADMIN_PASSWORD"
if (-not $adminPass) { Write-Host "ADMIN_PASSWORD is not set. Run .\scripts\start-all.ps1 once so it is created." -ForegroundColor Red; exit 1 }
$adminAuth = "Basic " + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${adminUser}:$adminPass"))
$script:pass = 0
$script:fail = 0

function Check([string]$name, [bool]$ok, [string]$detail = "") {
    if ($ok) { $script:pass++; Write-Host "  PASS  $name" -ForegroundColor Green }
    else     { $script:fail++; Write-Host "  FAIL  $name  $detail" -ForegroundColor Red }
}

# Returns @{ Status; Body } and never throws on a non-2xx status.
function Post-Json([string]$path, [string]$json, [switch]$Anonymous) {
    $headers = @{}
    if (-not $Anonymous) { $headers["Authorization"] = $adminAuth }
    try {
        $r = Invoke-WebRequest -Method Post -Uri "$BaseUrl$path" -ContentType "application/json" -Body $json -Headers $headers -UseBasicParsing
        return @{ Status = [int]$r.StatusCode; Body = $r.Content }
    } catch {
        $resp = $_.Exception.Response
        if (-not $resp) { throw }
        $body = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
        return @{ Status = [int]$resp.StatusCode; Body = $body }
    }
}

# Form login: GET /login for the CSRF token, POST credentials, return where the 302 points.
# HttpClient with auto-redirect off, because Windows PowerShell 5.1 throws on a blocked redirect.
Add-Type -AssemblyName System.Net.Http
function Try-Login([string]$user, [string]$pass) {
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $handler.CookieContainer = New-Object System.Net.CookieContainer
    $client = New-Object System.Net.Http.HttpClient($handler)
    try {
        $html = $client.GetStringAsync("$BaseUrl/login").Result
        $csrf = [regex]::Match($html, 'name="_csrf"[^>]*value="([^"]+)"').Groups[1].Value
        if (-not $csrf) { $csrf = [regex]::Match($html, 'value="([^"]+)"[^>]*name="_csrf"').Groups[1].Value }
        $form = New-Object 'System.Collections.Generic.Dictionary[string,string]'
        $form["username"] = $user; $form["password"] = $pass; $form["_csrf"] = $csrf
        $resp = $client.PostAsync("$BaseUrl/login", (New-Object System.Net.Http.FormUrlEncodedContent($form))).Result
        return [string]$resp.Headers.Location
    } finally { $client.Dispose() }
}

try { Invoke-WebRequest -Uri "$BaseUrl/login" -UseBasicParsing | Out-Null }
catch { Write-Host "Auth server not reachable at $BaseUrl. Start it first." -ForegroundColor Red; exit 1 }

# One admin call before the real run. A wrong admin password counts as a failed login, and 5 in a
# row lock the admin for 15 minutes, so a bad password must cost one attempt, not the whole script.
# An empty body is rejected with 400 when the login is fine, so this creates nothing.
$probe = Post-Json "/register" "{}"
if ($probe.Status -eq 401) {
    Write-Host "STOPPED: the server refused the admin login (401), so no more attempts were made." -ForegroundColor Red
    Write-Host "  Likely causes: ADMIN_PASSWORD here differs from the one the admin was seeded with, the admin is locked" -ForegroundColor Red
    Write-Host "  (5 wrong passwords lock it for 15 minutes), or the auth server is not the one started with ADMIN_PASSWORD." -ForegroundColor Red
    Write-Host "  Fix: open a new terminal, check ADMIN_USERNAME / ADMIN_PASSWORD, and see README > Resetting the admin." -ForegroundColor Red
    exit 1
}
if ($probe.Status -eq 403) {
    Write-Host "STOPPED: '$adminUser' logged in but is not an admin (403). Check its roles in the users table." -ForegroundColor Red
    exit 1
}

$user  ="tester" + (Get-Date -Format "HHmmss")
$email = "$user@example.com"
$pw    = "Str0ngPass!"

Write-Host "`nPOST /register" -ForegroundColor Cyan
$r = Post-Json "/register" (@{ username = "anon-$user"; password = $pw; email = "anon-$email" } | ConvertTo-Json) -Anonymous
Check "no login returns 401 (admin only)" ($r.Status -eq 401) "got $($r.Status): $($r.Body)"
$r = Post-Json "/register" (@{ username = $user; password = $pw; email = $email } | ConvertTo-Json)
Check "valid registration returns 201" ($r.Status -eq 201) "got $($r.Status): $($r.Body)"
$obj = $null; try { $obj = $r.Body | ConvertFrom-Json } catch {}
Check "response has id and username" ($obj -and $obj.id -and $obj.username -eq $user) $r.Body
Check "response never contains the password or a hash" ($r.Body -notmatch 'password|bcrypt|\$2a') $r.Body

$r = Post-Json "/register" (@{ username = $user; password = $pw; email = "other-$email" } | ConvertTo-Json)
Check "duplicate username returns 409" ($r.Status -eq 409) "got $($r.Status): $($r.Body)"
Check "duplicate username error code is USER_ALREADY_EXISTS" ($r.Body -match "USER_ALREADY_EXISTS") $r.Body

$r = Post-Json "/register" (@{ username = "$user-b"; password = $pw; email = $email } | ConvertTo-Json)
Check "duplicate email returns 409" ($r.Status -eq 409) "got $($r.Status): $($r.Body)"
Check "duplicate email response leaks no SQL" ($r.Body -notmatch "constraint|SQL|users_") $r.Body

$r = Post-Json "/register" (@{ username = "$user-c"; password = "short"; email = "c-$email" } | ConvertTo-Json)
Check "password under 8 chars returns 400" ($r.Status -eq 400) "got $($r.Status): $($r.Body)"
Check "validation error code is VALIDATION_ERROR" ($r.Body -match "VALIDATION_ERROR") $r.Body

$r = Post-Json "/register" (@{ username = "ab"; password = $pw; email = "d-$email" } | ConvertTo-Json)
Check "username under 3 chars returns 400" ($r.Status -eq 400) "got $($r.Status)"

$r = Post-Json "/register" (@{ username = "$user-e"; password = $pw; email = "not-an-email" } | ConvertTo-Json)
Check "invalid email returns 400" ($r.Status -eq 400) "got $($r.Status)"

$r = Post-Json "/register" (@{ username = "$user-f" } | ConvertTo-Json)
Check "missing fields return 400" ($r.Status -eq 400) "got $($r.Status)"

$r = Post-Json "/register" "{ this is not json"
Check "malformed JSON returns 400" ($r.Status -eq 400) "got $($r.Status)"

Write-Host "`nLogin with the new user" -ForegroundColor Cyan
$loc = Try-Login $user $pw
Check "correct password logs in (redirect is not /login?error)" ($loc -and $loc -notmatch "error" ) "Location: $loc"
$loc = Try-Login $user "wrong-password-123"
Check "wrong password is rejected (/login?error)" ($loc -match "error") "Location: $loc"
$loc = Try-Login "no-such-user-$user" $pw
Check "unknown user is rejected (/login?error)" ($loc -match "error") "Location: $loc"
$loc = Try-Login "nithin" "password"
Check "old in-memory user nithin/password no longer works" ($loc -match "error") "Location: $loc"

Write-Host "`nProtected paths" -ForegroundColor Cyan
$h = New-Object System.Net.Http.HttpClientHandler
$h.AllowAutoRedirect = $false
$c = New-Object System.Net.Http.HttpClient($h)
$resp = $c.GetAsync("$BaseUrl/oauth2/authorize?response_type=code&client_id=payment-client").Result
$code = [int]$resp.StatusCode
$c.Dispose()
Check "OAuth authorize without login redirects to login (302)" ($code -eq 302 -and [string]$resp.Headers.Location -match "/login") "got $code"

Write-Host ""
$color = if ($script:fail -eq 0) { "Green" } else { "Red" }
Write-Host ("{0} passed, {1} failed  (test user: {2})" -f $script:pass, $script:fail, $user) -ForegroundColor $color
exit $(if ($script:fail -eq 0) { 0 } else { 1 })
