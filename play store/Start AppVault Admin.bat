@echo off
title AppVault Admin Web Panel
color 0b
cls

echo ======================================================================
echo                     AppVault Admin Web Panel Launcher
echo ======================================================================
echo.

:: 1. Check if server is already running on port 3000
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %ERRORLEVEL% EQU 0 (
    echo [INFO] AppVault Admin server is already running on port 3000.
    echo [INFO] Opening http://localhost:3000 in your browser...
    start http://localhost:3000
    echo.
    echo ======================================================================
    echo AppVault Admin is active at http://localhost:3000
    echo You can safely close this launcher window.
    echo ======================================================================
    ping 127.0.0.1 -n 4 >nul
    exit /b 0
)

:: 2. If not running, prepare background waiter to open browser when ready
echo [INFO] Server is not running. Starting Next.js development server...
echo [INFO] Waiting for server to become available on http://localhost:3000...
echo.

start /b powershell -NoProfile -WindowStyle Hidden -Command ^
  "$url = 'http://localhost:3000';" ^
  "for ($i=0; $i -lt 90; $i++) {" ^
  "    Start-Sleep -Seconds 1;" ^
  "    try {" ^
  "        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop;" ^
  "        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) {" ^
  "            Start-Process $url;" ^
  "            break;" ^
  "        }" ^
  "    } catch {" ^
  "        if ($_.Exception.Response.StatusCode) {" ^
  "            Start-Process $url;" ^
  "            break;" ^
  "        }" ^
  "    }" ^
  "}"

:: 3. cd into admin-web directory and start development server
cd /d "D:\web\mmmut\play store\admin-web"
echo [INFO] Working directory: %CD%
echo [INFO] Executing npm run dev...
echo.

call npm run dev

echo.
echo ======================================================================
echo AppVault Admin server stopped.
echo ======================================================================
pause
