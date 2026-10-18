<#
Shared by the other scripts (dot-source it:  . "$PSScriptRoot\secrets.ps1").
Local secrets live in your Windows USER environment variables, never in git:
  PAYMENT_CLIENT_SECRET, SERVICE_B_CLIENT_SECRET, H2_PASSWORD, ADMIN_PASSWORD (first admin of the auth server)
Get-LocalSecret returns the value (process env first, then the saved user env).
Initialize-LocalSecrets creates any missing one with a random value and saves it.
#>

function Get-LocalSecret([string]$name) {
    $v = [Environment]::GetEnvironmentVariable($name, "Process")
    if (-not $v) { $v = [Environment]::GetEnvironmentVariable($name, "User") }
    return $v
}

function New-RandomSecret {
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).Replace("+", "A").Replace("/", "B").Replace("=", "")
}

# Returns the names it created, so the caller can react (e.g. H2 file is now stale).
function Initialize-LocalSecrets {
    $created = @()
    foreach ($name in "PAYMENT_CLIENT_SECRET", "SERVICE_B_CLIENT_SECRET", "H2_PASSWORD", "ADMIN_PASSWORD") {
        $v = Get-LocalSecret $name
        if (-not $v) {
            $v = New-RandomSecret
            [Environment]::SetEnvironmentVariable($name, $v, "User")
            $created += $name
        }
        Set-Item "env:$name" $v      # child processes (mvn) inherit it
    }
    return $created
}
