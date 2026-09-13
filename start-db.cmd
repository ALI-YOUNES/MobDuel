@echo off
setlocal

REM Start PostgreSQL for MobDuel on port 5432 by launching pg.exe directly.
REM Edit PGBIN and PGDATA below to match your local installation.

set "PGBIN=C:\Program Files\PostgreSQL\16\bin"
set "PGDATA=C:\Users\PC\AppData\Local\mobduel-pgdata2"
set "PORT=5432"

if not exist "%PGBIN%\pg_ctl.exe" (
  echo ERROR: PostgreSQL bin folder not found at "%PGBIN%".
  echo Update the PGBIN variable in this script to your PostgreSQL bin folder.
  endlocal
  exit /b 1
)

if not exist "%PGDATA%" (
  echo ERROR: data directory "%PGDATA%" not found.
  echo Initialize one with: "%PGBIN%\initdb.exe" -D "%PGDATA%"
  endlocal
  exit /b 1
)

set "PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  if not defined PID set "PID=%%a"
)

if defined PID (
  echo Port %PORT% is already in use by PID %PID%.
  tasklist /FI "PID eq %PID%"
  set /p "choice=Kill it and restart PostgreSQL? [y/N] "
  if /i not "%choice%"=="y" (
    echo Leaving the existing process running.
    endlocal
    exit /b 0
  )
  taskkill /PID %PID% /F >nul 2>&1
  if errorlevel 1 (
    echo Failed to kill PID %PID%. You may need to close it manually.
    endlocal
    exit /b 1
  )
  echo Killed PID %PID%.
  ping -n 2 127.0.0.1 >nul
) else (
  echo Port %PORT% is free.
)

echo Starting PostgreSQL (port %PORT%) via postgres.exe...
start "MobDuel PostgreSQL" /D "%PGBIN%" /B "%PGBIN%\postgres.exe" -D "%PGDATA%" -p %PORT%

REM Wait until the server accepts connections.
set /a tries=0
:waitloop
if "%tries%" geq 30 (
  echo ERROR: PostgreSQL did not come up within 30s.
  endlocal
  exit /b 1
)
"%PGBIN%\pg_isready.exe" -p %PORT% >nul 2>&1
if errorlevel 1 (
  set /a tries+=1
  ping -n 2 127.0.0.1 >nul
  goto waitloop
)

echo PostgreSQL started on port %PORT%.
endlocal

REM ---------------------------------------------------------------------------
REM Manual reference - the commands actually used to start the DB last time
REM (via PowerShell), in case the script above needs troubleshooting:
REM
REM   $env:PGBIN = "C:\Program Files\PostgreSQL\16\bin"
REM   $env:PGDATA = "C:\Users\PC\AppData\Local\mobduel-pgdata2"
REM
REM   # Kill whatever holds port 5432 if needed:
REM   netstat -ano | findstr :5432
REM   taskkill /PID <PID> /F
REM
REM   # Start the server directly with postgres.exe:
REM   & "C:\Program Files\PostgreSQL\16\bin\postgres.exe" -D "C:\Users\PC\AppData\Local\mobduel-pgdata2" -p 5432
REM
REM   # Verify it is accepting connections:
REM   & "C:\Program Files\PostgreSQL\16\bin\pg_isready.exe" -p 5432
REM
REM   # Connect:
REM   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -U mobduel -d mobduel
REM ---------------------------------------------------------------------------
