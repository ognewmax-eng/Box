@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
node start.js
if errorlevel 1 (
  echo.
  echo Ошибка запуска. Убедитесь, что установлен Node.js: https://nodejs.org/
  pause
)
