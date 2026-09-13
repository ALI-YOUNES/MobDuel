```bat
@echo off
setlocal EnableExtensions

title MobDuel Launcher

REM ==========================================
REM MOBDUEL ROOT
REM ==========================================

set "ROOT=%USERPROFILE%\Desktop\mobduel"

if not exist "%ROOT%" (
    echo.
    echo [ERROR] MobDuel folder not found:
    echo %ROOT%
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo             MOBDUEL LAUNCHER
echo ==========================================
echo.

REM ==========================================
REM 1. START DATABASE FIRST
REM ==========================================

echo [1/3] Starting database...
echo.

start "MobDuel - Database" cmd /k "cd /d ""%ROOT%"" && call ""%ROOT%\start-db.cmd"""

REM Give the database time to start
echo Waiting for database...
timeout /t 5 /nobreak >nul

REM ==========================================
REM 2. START FRONTEND
REM ==========================================

echo.
echo [2/3] Starting frontend...
echo.

start "MobDuel - Frontend" cmd /k "cd /d ""%ROOT%"" && npm run dev"

REM ==========================================
REM 3. START BACKEND
REM ==========================================

echo.
echo [3/3] Starting backend...
echo.

start "MobDuel - Backend" cmd /k "cd /d ""%ROOT%\backend"" && npm run start:dev"

REM ==========================================
REM DONE
REM ==========================================

echo.
echo ==========================================
echo          MOBDUEL STARTED
echo ==========================================
echo.
echo Database : Started first
echo Frontend : npm run dev
echo Backend  : npm run start:dev
echo.
echo All services are running in separate windows.
echo ==========================================
echo.

pause
```
