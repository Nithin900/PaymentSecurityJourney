<#
End-to-end test of the whole system, PowerShell only (no Postman).
Needs all four services running (scripts\start-all.ps1).

It logs in as nithin, alice and a read-only nithin through the real OAuth2
authorization-code flow (login page, consent, token), then checks services A, B
and the notification service. Prints PASS / FAIL per check and exits 1 if any
check failed. Each FAIL says which README troubleshooting entry to read.

Usage:  .\scripts\test-all.ps1
#>

Add-Type -AssemblyName System.Net.Http

$auth   = "http://localhost:9000"
$a      = "http://localhost:8080"
$b      = "http://localhost:8081"
$notify = "http://localhost:8082"
$redirect = "https://oauth.pstmn.io/v1/callback"
$logDir = Join-Path $PSScriptRoot "logs"

$script:pass = 0
$script:fail = 0

# ---------- helpers ----------

function New-Client([bool]$cookies) {
    $h = New-Object System.Net.Http.HttpClientHandler
    $h.AllowAutoRedirect = $false
    if ($cookies) { $h.CookieContainer = New-Object System.Net.CookieContainer; $h.UseCookies = $true }
    $c = New-Object System.Net.Http.HttpClient($h)
    $c.Timeout = [TimeSpan]::FromSeconds(30)
    return $c
}

# One HTTP call that never throws on 4xx/5xx. Returns Status, Body, Location.
function Send($client, $method, $url, $token = $null, $json = $null, $form = $null, $basic = $null) {
    $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new($method), $url)
    if ($token) { $req.Headers.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token) }
    if ($basic) {
        $raw = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($basic))
        $req.Headers.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Basic", $raw)
    }
    if ($null -ne $json) { $req.Content = New-Object System.Net.Http.StringContent($json, [Text.Encoding]::UTF8, "application/json") }
    if ($null -ne $form) {
        $pairs = New-Object 'System.Collections.Generic.List[System.Collections.Generic.KeyValuePair[string,string]]'
        foreach ($kv in $form) { $pairs.Add([System.Collections.Generic.KeyValuePair[string,string]]::new($kv[0], $kv[1])) }
        $req.Content = New-Object System.Net.Http.FormUrlEncodedContent($pairs)
    }
    try {
        $resp = $client.SendAsync($req).GetAwaiter().GetResult()
        $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $loc = ""
        if ($resp.Headers.Location) { $loc = $resp.Headers.Location.ToString() }
        return [pscustomobject]@{ Status = [int]$resp.StatusCode; Body = $body; Location = $loc }
    } catch {
        return [pscustomobject]@{ Status = 0; Body = $_.Exception.Message; Location = "" }
    }
}

function Abs($loc) { if ($loc.StartsWith("http")) { $loc } else { "$auth$loc" } }

function Check($name, [bool]$ok, $detail, $hint) {
    if ($ok) {
        $script:pass++
        Write-Host ("  PASS  {0}" -f $name) -ForegroundColor Green
    } else {
        $script:fail++
        Write-Host ("  FAIL  {0}" -f $name) -ForegroundColor Red
        Write-Host ("        got: {0}" -f $detail) -ForegroundColor Yellow
        if ($hint) { Write-Host ("        fix: README > Troubleshooting > {0}" -f $hint) -ForegroundColor Yellow }
    }
}

function Decode-Jwt($token) {
    $p = $token.Split(".")[1].Replace("-", "+").Replace("_", "/")
    while ($p.Length % 4) { $p += "=" }
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p)) | ConvertFrom-Json
}

# Real authorization-code flow: login page -> consent -> code -> token.
function Get-UserToken($user, $scopes) {
    $c = New-Client $true
    $scopeParam = ($scopes -join "%20")
    $authorize = "$auth/oauth2/authorize?response_type=code&client_id=payment-client&scope=$scopeParam&redirect_uri=$redirect&state=s1"

    $r = Send $c "GET" $authorize
    if ($r.Status -ne 302) { throw "authorize did not redirect to login (status $($r.Status))" }
    $r = Send $c "GET" "$auth/login"
    $m = [regex]::Match($r.Body, 'name="_csrf"[^>]*?value="([^"]+)"')
    if (-not $m.Success) { throw "no CSRF token on the login page" }
    $r = Send $c "POST" "$auth/login" -form @(@("username", $user), @("password", "password"), @("_csrf", $m.Groups[1].Value))
    if ($r.Status -ne 302 -or $r.Location -match "error") { throw "login rejected for $user (status $($r.Status), $($r.Location))" }

    $r = Send $c "GET" $authorize
    $code = [regex]::Match($r.Location, '[?&]code=([^&]+)')
    if (-not $code.Success) {
        # consent page: submit the scopes
        $st = [regex]::Match($r.Body, 'name="state"[^>]*?value="([^"]+)"')
        if (-not $st.Success) { throw "neither a code nor a consent page came back (status $($r.Status))" }
        $form = @(@("client_id", "payment-client"), @("state", $st.Groups[1].Value))
        foreach ($s in $scopes) { $form += ,@("scope", $s) }
        $r = Send $c "POST" "$auth/oauth2/authorize" -form $form
        $code = [regex]::Match($r.Location, '[?&]code=([^&]+)')
        if (-not $code.Success) { throw "consent did not return a code (status $($r.Status))" }
    }

    $t = Send (New-Client $false) "POST" "$auth/oauth2/token" -basic "payment-client:secret" `
        -form @(@("grant_type", "authorization_code"), @("code", $code.Groups[1].Value), @("redirect_uri", $redirect))
    if ($t.Status -ne 200) { throw "token endpoint returned $($t.Status): $($t.Body)" }
    return ($t.Body | ConvertFrom-Json).access_token
}

$http = New-Client $false
function Pay($method, $path, $token, $json = $null) { Send $http $method "$a$path" $token $json }
function PayJson($id) { "{""paymentId"":""$id"",""accountNumber"":""acc-123"",""amount"":25.00}" }

# ---------- 0. health ----------
Write-Host "`n0. Are the services up?"
$svc = @(
    @{ N = "Auth server  :9000"; U = "$auth/.well-known/openid-configuration"; Want = 200 },
    @{ N = "Service A    :8080"; U = "$a/payments";                            Want = 401 },
    @{ N = "Service B    :8081"; U = "$b/payments";                            Want = 401 },
    @{ N = "Notification :8082"; U = "$notify/notifications";                  Want = 401 }
)
$allUp = $true
foreach ($s in $svc) {
    $r = Send $http "GET" $s.U
    $ok = ($r.Status -eq $s.Want)
    if (-not $ok) { $allUp = $false }
    Check $s.N $ok "HTTP $($r.Status) (wanted $($s.Want))" "A service is not reachable / wrong status"
}
if (-not $allUp) {
    Write-Host "`nNot every service is up, so the rest would only produce noise. Stopping." -ForegroundColor Red
    exit 1
}

# ---------- 1. tokens ----------
Write-Host "`n1. Log in and get tokens (real OAuth2 flow)"
try {
    $tokN = Get-UserToken "nithin" @("payment.read", "payment.write")
    $tokA = Get-UserToken "alice"  @("payment.read", "payment.write")
    $tokR = Get-UserToken "nithin" @("payment.read")
} catch {
    Check "Login and token" $false $_.Exception.Message "Login or token step fails"
    exit 1
}
$pn = Decode-Jwt $tokN
$pr = Decode-Jwt $tokR
Check "nithin token: sub = nithin"          ($pn.sub -eq "nithin") $pn.sub "Login or token step fails"
Check "nithin token: has payment.write"     (@($pn.scope) -contains "payment.write") ($pn.scope -join ",") "Login or token step fails"
Check "reader token: no payment.write"      (-not (@($pr.scope) -contains "payment.write")) ($pr.scope -join ",") "Login or token step fails"

# ---------- 2. service A ----------
Write-Host "`n2. Service A (gateway :8080) -> B -> H2"
$id = "PS-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$roId = "RO-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$r = Pay "POST" "/payments" $null (PayJson $id)
Check "POST without token -> 401" ($r.Status -eq 401) $r.Status "401 or 403 where it should not be"
$r = Pay "GET" "/payments" "garbage.token.value"
Check "GET with garbage token -> 401" ($r.Status -eq 401) $r.Status "401 or 403 where it should not be"

$r = Pay "POST" "/payments" $tokN (PayJson $id)
Check "nithin creates payment -> 200" ($r.Status -eq 200) "$($r.Status) $($r.Body)" "Create payment does not return 200"
$r = Pay "GET" "/payments/$id" $tokN
Check "nithin gets it -> 200" ($r.Status -eq 200) "$($r.Status) $($r.Body)" "Create payment does not return 200"
$r = Pay "GET" "/payments" $tokN
Check "nithin's list contains it" ($r.Status -eq 200 -and $r.Body -match [regex]::Escape($id)) "$($r.Status)" "Create payment does not return 200"

$r = Pay "GET" "/payments/$id" $tokA
Check "alice gets nithin's payment -> 404 (ownership)" ($r.Status -eq 404) $r.Status "Ownership check fails"
$r = Pay "GET" "/payments" $tokA
Check "alice's list does not contain it" ($r.Status -eq 200 -and $r.Body -notmatch [regex]::Escape($id)) "$($r.Status)" "Ownership check fails"

$r = Pay "POST" "/payments" $tokN (PayJson $id)
Check "duplicate payment id -> 409" ($r.Status -eq 409) $r.Status "409 / 400 / 404 error mapping is wrong"
$r = Pay "POST" "/payments" $tokN "{""paymentId"":""NEG-1"",""accountNumber"":""acc-123"",""amount"":-5}"
Check "negative amount -> 400" ($r.Status -eq 400) $r.Status "409 / 400 / 404 error mapping is wrong"
$r = Pay "POST" "/payments" $tokN "{ this is not json"
Check "malformed JSON -> 400 MALFORMED_REQUEST_BODY" ($r.Status -eq 400 -and $r.Body -match "MALFORMED_REQUEST_BODY") "$($r.Status) $($r.Body)" "409 / 400 / 404 error mapping is wrong"
$r = Pay "GET" "/no-such-route" $tokN
Check "unmapped route -> 404 NOT_FOUND" ($r.Status -eq 404 -and $r.Body -match "NOT_FOUND") "$($r.Status) $($r.Body)" "409 / 400 / 404 error mapping is wrong"

$r = Pay "POST" "/payments" $tokR (PayJson $roId)
Check "read-only token: POST -> 403" ($r.Status -eq 403) $r.Status "401 or 403 where it should not be"
$r = Pay "GET" "/payments" $tokR
Check "read-only token: GET list -> 200" ($r.Status -eq 200 -and $r.Body -match [regex]::Escape($id)) $r.Status "401 or 403 where it should not be"

# ---------- 3. service B directly ----------
Write-Host "`n3. Service B directly (:8081) - B never trusts A"
$r = Send $http "GET" "$b/payments/$id" $tokN
Check "B: owner reads it -> 200" ($r.Status -eq 200) $r.Status "Ownership check fails"
$r = Send $http "GET" "$b/payments/$id" $tokA
Check "B: alice -> 404" ($r.Status -eq 404) $r.Status "Ownership check fails"
$r = Send $http "GET" "$b/payments/$id"
Check "B: no token -> 401" ($r.Status -eq 401) $r.Status "401 or 403 where it should not be"

# ---------- 4. notification service ----------
Write-Host "`n4. Notification service (:8082)"
$body = "{""paymentId"":""X-1"",""owner"":""nithin"",""amount"":10.00,""status"":""SUCCESS""}"
$r = Send $http "POST" "$notify/notifications" -json $body
Check "no token -> 401" ($r.Status -eq 401) $r.Status "Notification service: 401 / 403 / 502"
$r = Send $http "POST" "$notify/notifications" $tokN $body
Check "user token without notification.send -> 403" ($r.Status -eq 403) $r.Status "Notification service: 401 / 403 / 502"

# B's service-to-service token (client credentials)
$cc = Send $http "POST" "$auth/oauth2/token" -basic "payment-service-b:b-secret" -form @(@("grant_type", "client_credentials"), @("scope", "notification.send"))
Check "B gets a client_credentials token" ($cc.Status -eq 200) "$($cc.Status) $($cc.Body)" "B cannot get its notification token"

$blog = Join-Path $logDir "payment-service-b.log"
if (Test-Path $blog) {
    Start-Sleep -Seconds 2
    $txt = Get-Content $blog -Raw
    $sent = $txt -match "Notification requested for payment $id"
    $warn = $txt -match "Payment $id saved, but the notification could not be sent"
    Check "B asked the notification service about $id" $sent $(if ($warn) { "B logged that the notification failed" } else { "no log line found" }) "Payment works but no email arrives"
} else {
    Write-Host "  SKIP  B log check (no scripts\logs\payment-service-b.log - services not started with start-all.ps1)" -ForegroundColor DarkYellow
}

# ---------- result ----------
Write-Host ""
$color = "Green"
if ($script:fail -gt 0) { $color = "Red" }
Write-Host ("Result: {0} passed, {1} failed" -f $script:pass, $script:fail) -ForegroundColor $color
Write-Host "Payment id used: $id  (an email for it should reach the address set in NotificationService application-local.yaml)"
if ($script:fail -gt 0) { exit 1 }
