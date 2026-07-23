@echo off
setlocal
REM Serve the PROJECT ROOT (one level up) so index.html / data.json are reachable
pushd "%~dp0.."
echo ============================================
echo    StagwithyouFerns - config.ini live editor
echo ============================================
echo.

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY ( where py >nul 2>nul && set "PY=py" )
if not defined PY (
  echo [ERROR] Python not found. Install Python 3 and tick "Add Python to PATH":
  echo         https://www.python.org/downloads/
  pause & popd & exit /b 1
)
echo Using Python: %PY%
echo.
echo Starting a local web server at http://localhost:8137/
echo Opening the editor in your browser now...
echo.
echo *** KEEP THIS WINDOW OPEN while you edit. Close it when you are done. ***
echo.

start "" "http://localhost:8137/config/config-editor.html"
%PY% -m http.server 8137
if errorlevel 1 (
  echo.
  echo [ERROR] Could not start the server. Port 8137 may be in use.
  pause
)
popd
endlocal
