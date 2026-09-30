<#
Stops all services. Uses scripts\pids.json (written by start-all.ps1) and kills each process tree
(mvn wraps the actual java process, so a plain Stop-Process won't reach it).
Then, as a safety net, kills anything still listening on the four service ports, so it also
works when pids.json is missing or stale, or when a service was started by hand.
#>

$pidsFile = Join-Path $PSScriptRoot "pids.json"

if (Test-Path $pidsFile) {
    $pids = Get-Content $pidsFile | ConvertFrom-Json
    foreach ($name in $pids.PSObject.Properties.Name) {
        $procId = $pids.$name
        Write-Host "Stopping $name (PID $procId)..."
        taskkill /PID $procId /T /F 2>$null | Out-Null
    }
    Remove-Item $pidsFile -Force
} else {
    Write-Host "No pids.json found, checking the service ports instead."
}

foreach ($port in 9000, 8081, 8080, 8082) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "Stopping process $($_.OwningProcess) still listening on port $port..."
        taskkill /PID $_.OwningProcess /T /F 2>$null | Out-Null
    }
}
Write-Host "All services stopped."
