@echo off
:: Запуск от имени администратора: добавляет правила брандмауэра для доступа с телефона.
:: Дважды щёлкните по файлу или вызовите из cmd (появится запрос UAC).

cd /d "%~dp0.."
for %%I in ("%~dp0add-firewall-rules.ps1") do set "SCRIPT=%%~fI"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT%\"' -Verb RunAs -Wait"
pause
