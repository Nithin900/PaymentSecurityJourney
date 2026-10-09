<#
All four service logs in one window, a colour and tag per service.
Usage:  .\scripts\watch-logs.ps1                  # new lines from now on
        .\scripts\watch-logs.ps1 -Last 20         # start with the last 20 lines of each log
        .\scripts\watch-logs.ps1 -Match PS-1791   # only lines containing a payment id or trace id
Ctrl+C stops it. Run start-all.ps1 first (it creates the log files).
#>
param([string]$Match = "", [int]$Last = 0)

$logDir = Join-Path $PSScriptRoot "logs"
$svc = @(
    @{ File = "payment-authorization-server"; Tag = "AUTH "; Color = "Cyan" },
    @{ File = "payment-service-b";            Tag = "B    "; Color = "Yellow" },
    @{ File = "payment-service-a";            Tag = "A    "; Color = "Green" },
    @{ File = "NotificationService";          Tag = "NOTIF"; Color = "Magenta" }
)

foreach ($s in $svc) {
    if (-not (Test-Path (Join-Path $logDir "$($s.File).log"))) {
        Write-Host "Missing $($s.File).log in $logDir. Run .\scripts\start-all.ps1 first." -ForegroundColor Red
        exit 1
    }
}

$jobs = foreach ($s in $svc) {
    Start-Job -ArgumentList (Join-Path $logDir "$($s.File).log"), $Last -ScriptBlock {
        param($path, $last)
        Get-Content -Path $path -Wait -Tail $last
    }
}

try {
    while ($true) {
        for ($i = 0; $i -lt $svc.Count; $i++) {
            foreach ($line in @(Receive-Job $jobs[$i] -ErrorAction SilentlyContinue)) {
                if ($Match -and $line -notmatch [regex]::Escape($Match)) { continue }
                Write-Host ("{0} | {1}" -f $svc[$i].Tag, $line) -ForegroundColor $svc[$i].Color
            }
        }
        Start-Sleep -Milliseconds 300
    }
} finally {
    $jobs | Stop-Job
    $jobs | Remove-Job -Force
}