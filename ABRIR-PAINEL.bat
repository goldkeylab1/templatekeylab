@echo off
rem Dois cliques aqui abrem o painel no navegador - Windows.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto semnode
node painel\ligar.js --abrir
timeout /t 3 >nul
exit /b 0

:semnode
echo.
echo Falta instalar o Node, que e de graca. Vou abrir o site: baixe a versao LTS e instale.
start "" https://nodejs.org
echo.
pause
exit /b 1
