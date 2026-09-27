<#
Stops all services started by start-all.ps1, killing each process tree
(mvn wraps the actual java process, so a plain Stop-Process won't reach it).
#>

$pidsFile = Join-Path $PSScriptRoot "pids.json"

if (-not (Test-Path $pidsFile)) {
    Write-Host "No pids.json found - nothing to stop (or services weren't started via start-all.ps1)."
    exit 0
}

$pids = Get-Content $pidsFile | ConvertFrom-Json

foreach ($name in $pids.PSObject.Properties.Name) {
    $procId = $pids.$name
    Write-Host "Stopping $name (PID $procId)..."
    try {
        taskkill /PID $procId /T /F | Out-Null
    } catch {
        Write-Host "  (already stopped)"
    }
}

Remove-Item $pidsFile -Force
Write-Host "All services stopped."
