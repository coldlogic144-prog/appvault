@echo off
echo ========================================================
echo Launching ComicLink - Operative Beta (User B) Session
echo ========================================================
echo.
echo Launching second Electron instance with isolated session profile:
echo Profile Directory: %%TEMP%%\comiclink-user-b
echo.
echo Credentials for User B:
echo   Email:    userb@comiclink.local
echo   Passcode: Password123!
echo.
cd /d "%~dp0..\apps\windows"
call npx electron . --user-data-dir="%TEMP%\comiclink-user-b"
