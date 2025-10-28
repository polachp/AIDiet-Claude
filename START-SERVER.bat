@echo off
echo ========================================
echo   AI Diet - Lokalni server
echo ========================================
echo.
echo Startuje server na http://localhost:8000
echo.
echo Pro zastaveni stisknete CTRL+C
echo ========================================
echo.

REM Zkusit Python 3
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Pouzivam Python...
    python -m http.server 8000
    goto :end
)

REM Zkusit PHP
where php >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Pouzivam PHP...
    php -S localhost:8000
    goto :end
)

REM Zkusit Node.js
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Pouzivam Node.js...
    npx serve -p 8000
    goto :end
)

echo.
echo CHYBA: Nenalezen Python, PHP ani Node.js
echo Nainstalujte prosim jeden z nich.
echo.
pause

:end
