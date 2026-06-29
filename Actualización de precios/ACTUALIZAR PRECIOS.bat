@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   rødën OS — Actualización de Precios    ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Buscar el PDF de Placas más reciente en la carpeta
set PLACAS=
for /f "delims=" %%F in ('dir /b /o:-d "Lista de Precios Placas*.pdf" 2^>nul') do (
    if not defined PLACAS set PLACAS=%%F
)

:: Buscar el PDF de Herrajes más reciente en la carpeta
set HERRAJES=
for /f "delims=" %%F in ('dir /b /o:-d "Lista de Precios Herrajes*.pdf" 2^>nul') do (
    if not defined HERRAJES set HERRAJES=%%F
)

:: Verificar que se encontraron ambos PDFs
if not defined PLACAS (
    echo  ❌ No se encontró el PDF de Placas e Insumos.
    echo     Copiá el archivo a esta carpeta y volvé a ejecutar.
    echo.
    pause
    exit /b 1
)

if not defined HERRAJES (
    echo  ❌ No se encontró el PDF de Herrajes y Accesorios.
    echo     Copiá el archivo a esta carpeta y volvé a ejecutar.
    echo.
    pause
    exit /b 1
)

echo  PDFs detectados:
echo    Placas:   %PLACAS%
echo    Herrajes: %HERRAJES%
echo.

python update_prices.py --placas "%PLACAS%" --herrajes "%HERRAJES%" --apply

echo.
pause
