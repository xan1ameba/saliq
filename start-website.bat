@echo off
cd /d "%~dp0"
echo Starting Saliq AI at http://localhost:5500 ...
start "" cmd /c "timeout /t 1 >nul & start http://localhost:5500"
node server.js
pause
