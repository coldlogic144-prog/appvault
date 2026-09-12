@echo off
echo Starting ComicLink Development Environment...
echo.
echo Make sure Firebase emulators are running (scripts\emulators.cmd)
echo.
cd /d "%~dp0..\apps\windows"
call npx concurrently "npx vite" "npx wait-on http://localhost:5173 && npx electron ."
