@echo off
setlocal
pushd "%~dp0"
echo ============================================
echo    Staghorn Fern - Image to 3D (TRELLIS)
echo ============================================
echo.

REM --- find Python ---
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY ( where py >nul 2>nul && set "PY=py" )
if not defined PY (
  echo [ERROR] Python not found. Install Python 3 and tick "Add Python to PATH":
  echo         https://www.python.org/downloads/
  echo.
  pause
  popd
  exit /b 1
)
echo Using Python: %PY%

REM --- check packages, install only if missing ---
%PY% -c "import requests, PIL" 1>nul 2>nul
if errorlevel 1 (
  echo Missing packages detected. Installing requests and pillow ...
  %PY% -m pip install --upgrade pip
  %PY% -m pip install requests pillow
  if errorlevel 1 (
    echo [ERROR] Package install failed. Check your network or run as Administrator.
    pause
    popd
    exit /b 1
  )
) else (
  echo Packages OK.
)

echo.
echo Launching GUI ...
%PY% "%~dp0trellis_gui.py"
if errorlevel 1 (
  echo.
  echo The program reported an error. See the messages above.
  pause
)
popd
endlocal
