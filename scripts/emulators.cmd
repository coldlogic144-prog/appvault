@echo off
echo Starting Firebase Emulator Suite...
echo.
echo Requires: Java 17+, Firebase CLI
echo.

where java >nul 2>nul
if %errorlevel% neq 0 (
  if exist "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot\bin" (
    set "PATH=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot\bin;%PATH%"
  )
)

cd /d "%~dp0..\backend"
if exist "emulator-data" (
  call npx firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
) else (
  call npx firebase emulators:start
)

