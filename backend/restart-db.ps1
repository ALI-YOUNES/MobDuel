# Restart the PostgreSQL database fresh: kill any process/service on port
# 5432, then start an ad-hoc Postgres instance from the repo's local data
# cluster so the backend can reconnect on a clean server.
#
# Only touches port 5432 (the DB). The backend on 3001 is left as-is.
#
# HOW TO RUN:
#   powershell -ExecutionPolicy Bypass -File restart-db.ps1
#
# NOTE: If the postgresql Windows service is registered and set to Auto, it may
# grab port 5432 instead. This script stops it and sets it to Manual.

$ErrorActionPreference = "Stop"

$pgBin  = "C:\Program Files\PostgreSQL\16\bin"
$pgData = "C:\Users\PC\AppData\Local\PostgreSQL\data"
$pgLog  = "C:\Users\PC\AppData\Local\PostgreSQL\pg_server.log"
$port   = 5432
$svcName = "postgresql-x64-16"

if (-not (Test-Path "$pgData\PG_VERSION")) {
    Write-Error "PostgreSQL data directory not found at $pgData"
    exit 1
}

$ctl = "$pgBin\pg_ctl.exe"
$isReady = "$pgBin\pg_isready.exe"

Write-Host "==> Stopping anything on port $port =="

# 1) Cleanly shut down the cluster (covers a running ad-hoc instance).
& $ctl -D $pgData stop -m fast 2>$null | Out-Null

# 2) Stop + disable the Windows service so it can't steal the port on start.
$svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
if ($svc) {
    Write-Host "    Stopping service: $svcName"
    Stop-Service -Name $svcName -Force -ErrorAction SilentlyContinue
    if ($svc.StartType -ne "Disabled") {
        Set-Service -Name $svcName -StartupType Manual -ErrorAction SilentlyContinue
    }
}

# 3) Kill any lingering process still listening on the port.
for ($i = 0; $i -lt 10; $i++) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $conn) { break }
    foreach ($c in $conn) {
        Write-Host "    Killing PID $($c.OwningProcess) on port $port"
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 400
}

Start-Sleep -Seconds 2

Write-Host "==> Starting PostgreSQL (ad-hoc) on port $port =="

# Log the instance, not consuming a console (nodetach => spawn in background).
& $ctl -D $pgData -l $pgLog -o "-p $port" start

# 4) Wait until the server accepts connections.
for ($i = 0; $i -lt 20; $i++) {
    & $isReady -h localhost -p $port *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
}

& $isReady -h localhost -p $port
if ($LASTEXITCODE -ne 0) {
    Write-Error "PostgreSQL did not become ready on port $port. See log: $pgLog"
    exit 1
}

Write-Host "PostgreSQL is ready on port $port."
Write-Host "Log: $pgLog"
