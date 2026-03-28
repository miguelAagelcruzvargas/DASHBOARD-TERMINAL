@echo off
setlocal

REM Ir a la carpeta del proyecto (donde está este .bat)
cd /d "%~dp0"

REM Verificar npm disponible
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm no esta disponible en PATH.
  echo Instala Node.js y vuelve a intentar.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] No se encontro package.json en esta carpeta.
  pause
  exit /b 1
)

echo Iniciando Terminal AU...

echo [1/2] Backend API...
start "Terminal AU - API" cmd /k "cd /d "%~dp0" && npm run dev:server"

timeout /t 2 /nobreak >nul

echo [2/2] Frontend...
start "Terminal AU - Frontend" cmd /k "cd /d "%~dp0" && npm run dev:client"

echo.
echo Sistema iniciado en ventanas separadas.
echo - API:      http://localhost:8787/api/health
echo - Frontend: http://localhost:3000

echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
