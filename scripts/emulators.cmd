@echo off
echo Starting Firebase Emulator Suite...
echo.
echo Requires: Java 17+, Firebase CLI
echo.
cd /d "%~dp0..\backend"
call firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
