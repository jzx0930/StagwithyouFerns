@echo off
setlocal
pushd "%~dp0"
echo ============================================
echo   Vendor thinking-orbs into vendor\thinking-orbs.js
echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm not found. Install Node.js first:
  echo         https://nodejs.org/
  pause ^& popd ^& exit /b 1
)

if not exist package.json ( call npm init -y >nul 2>nul )

echo Installing thinking-orbs + react + esbuild ...
call npm install thinking-orbs@0.2.0 react@18.3.1 react-dom@18.3.1 esbuild --no-audit --no-fund
if errorlevel 1 (
  echo [ERROR] npm install failed. Check your network.
  pause ^& popd ^& exit /b 1
)

if not exist "%~dp0..\..\vendor" mkdir "%~dp0..\..\vendor"

echo Bundling ...
call npx esbuild entry.mjs --bundle --minify --format=iife --outfile="%~dp0..\..\vendor\thinking-orbs.js"
if errorlevel 1 (
  echo [ERROR] esbuild bundling failed.
  pause ^& popd ^& exit /b 1
)

echo.
echo Done. Created:  vendor\thinking-orbs.js
echo The site will now use the local copy (offline, no CDN).
echo (You can commit vendor\thinking-orbs.js; node_modules here is not needed in the repo.)
pause
popd
endlocal
