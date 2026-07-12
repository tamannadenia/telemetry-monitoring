#Requires -RunAsAdministrator
<#
  Resets the local PostgreSQL 18 "postgres" user password to: postgres
  Creates the telemetry_monitoring database if it does not exist.

  How to run:
    1. Right-click PowerShell → Run as administrator
    2. Execute:
       Set-ExecutionPolicy -Scope Process Bypass
       & "C:\Users\TamannaD\telemetry-monitoring\scripts\reset-postgres-password.ps1"
#>

$ErrorActionPreference = 'Stop'

$pgRoot = 'C:\Program Files\PostgreSQL\18'
$pgHba = Join-Path $pgRoot 'data\pg_hba.conf'
$psql = Join-Path $pgRoot 'bin\psql.exe'
$serviceName = 'postgresql-x64-18'
$newPassword = 'postgres'

if (-not (Test-Path $pgHba)) { throw "Could not find pg_hba.conf at $pgHba" }
if (-not (Test-Path $psql)) { throw "Could not find psql at $psql" }

Write-Host "Backing up pg_hba.conf..." -ForegroundColor Cyan
Copy-Item $pgHba "$pgHba.bak-$(Get-Date -Format yyyyMMddHHmmss)" -Force

Write-Host "Temporarily enabling trust auth for local connections..." -ForegroundColor Cyan
$lines = Get-Content $pgHba
$newLines = foreach ($line in $lines) {
  if ($line -match '^\s*#' -or $line.Trim() -eq '') {
    $line
  } elseif ($line -match '^\s*(local|host)\s+') {
    # Replace the auth method (last token) with trust
    ($line -replace '\S+\s*$', 'trust')
  } else {
    $line
  }
}
$newLines | Set-Content -Path $pgHba -Encoding ascii

Write-Host "Restarting $serviceName..." -ForegroundColor Cyan
Restart-Service -Name $serviceName -Force
Start-Sleep -Seconds 4

Write-Host "Setting postgres password to '$newPassword'..." -ForegroundColor Cyan
& $psql -U postgres -h 127.0.0.1 -d postgres -c "ALTER USER postgres WITH PASSWORD '$newPassword';"
if ($LASTEXITCODE -ne 0) { throw 'ALTER USER failed' }

Write-Host "Ensuring database telemetry_monitoring exists..." -ForegroundColor Cyan
$dbCheck = & $psql -U postgres -h 127.0.0.1 -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='telemetry_monitoring'"
if ($dbCheck -ne '1') {
  & $psql -U postgres -h 127.0.0.1 -d postgres -c "CREATE DATABASE telemetry_monitoring;"
  if ($LASTEXITCODE -ne 0) { throw 'CREATE DATABASE failed' }
} else {
  Write-Host "Database already exists." -ForegroundColor DarkGray
}

Write-Host "Restoring scram-sha-256 auth in pg_hba.conf..." -ForegroundColor Cyan
$lines = Get-Content $pgHba
$restored = foreach ($line in $lines) {
  if ($line -match '^\s*#' -or $line.Trim() -eq '') {
    $line
  } elseif ($line -match '^\s*(local|host)\s+') {
    ($line -replace '\S+\s*$', 'scram-sha-256')
  } else {
    $line
  }
}
$restored | Set-Content -Path $pgHba -Encoding ascii

Restart-Service -Name $serviceName -Force
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "User:     postgres" -ForegroundColor Green
Write-Host "Password: postgres" -ForegroundColor Green
Write-Host "Database: telemetry_monitoring" -ForegroundColor Green
Write-Host ""
Write-Host "Next commands (normal PowerShell is fine):" -ForegroundColor Yellow
Write-Host '  cd C:\Users\TamannaD\telemetry-monitoring\backend'
Write-Host '  npx prisma db push'
Write-Host '  npm run dev'
