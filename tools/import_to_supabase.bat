@echo off
setlocal
pushd "%~dp0"
echo ============================================
echo    StagwithyouFerns - import to Supabase
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

%PY% -c "import requests" 1>nul 2>nul
if errorlevel 1 (
  echo Installing dependencies ...
  %PY% -m pip install --upgrade pip
  %PY% -m pip install requests
  if errorlevel 1 (
    echo [ERROR] Package install failed. Check network or run as Administrator.
    pause & popd & exit /b 1
  )
) else (
  echo Packages OK.
)

echo.
echo Launching ...
set PYTHONIOENCODING=utf-8
chcp 65001 >nul
%PY% "%~dp0import_to_supabase.py" %*
echo.
pause
popd
endlocal
