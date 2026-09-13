# Setup script: register PostgreSQL 16 as a Windows service that auto-starts
# at boot, using the repo's local data cluster.
#
# HOW TO RUN:
#   1. Right-click PowerShell -> "Run as Administrator"
#   2. cd to this folder and run:
#        powershell -ExecutionPolicy Bypass -File setup-postgres-service.ps1
#
# This must run from an ELEVATED (admin) shell. It uses the system account so
# no service password is needed, and binds to localhost:5432.

$ErrorActionPreference = "Stop"

$pgBin  = "C:\Program Files\PostgreSQL\16\bin"
$pgData = "C:\Users\PC\AppData\Local\PostgreSQL\data"
$pgLog  = "C:\Users\PC\AppData\Local\PostgreSQL\pg_server.log"
$svcName = "postgresql-x64-16"

if (-not (Test-Path "$pgData\PG_VERSION")) {
    Write-Error "PostgreSQL data directory not found at $pgData"
    exit 1
}

# The data dir lives under a user AppData folder, so grant the service account
# (NT AUTHORITY\NetworkService) full access; otherwise the service cannot read
# or write the cluster or its log. Requires admin — which this script runs as.
$AclRoot = "C:\Users\PC\AppData\Local\PostgreSQL"
$acl = icacls $AclRoot /grant "NT AUTHORITY\NetworkService:(OI)(CI)F" /T
Write-Host $acl

# Stop any ad-hoc instance using this data dir so only the service owns it.
$ctl = "$pgBin\pg_ctl.exe"
& $ctl -D $pgData stop -m fast 2>$null | Out-Null

# Remove an existing registration if present, so we re-register cleanly.
$existing = Get-Service -Name $svcName -ErrorAction SilentlyContinue
if ($existing) {
    & $ctl unregister -N $svcName 2>$null | Out-Null
}

# Register the service. The postgres binary runs as NT AUTHORITY\NetworkService,
# -S auto = automatic start at boot. Runs on localhost:5432.
& $ctl register -N $svcName -D $pgData -S auto -o "-p 5432"

$svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Error "Service registration failed. Did you run as Administrator?"
    exit 1
}

# Start it now.
Start-Service -Name $svcName
Start-Sleep -Seconds 5
$svc = Get-Service -Name $svcName
Write-Host "Service state: $($svc.Status) (StartType: $($svc.StartType))"

& "C:\Program Files\PostgreSQL\16\bin\pg_isready.exe" -h localhost -p 5432
