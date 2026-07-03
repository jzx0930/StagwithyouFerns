@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ============================================
echo    鹿角蕨 圖片轉 3D 工具 (TRELLIS)
echo ============================================
echo.

REM --- 找 Python ---
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY ( where py >nul 2>nul && set "PY=py" )
if not defined PY (
  echo [錯誤] 找不到 Python。請先安裝 Python 3,安裝時勾選 "Add Python to PATH":
  echo         https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)
echo 使用 Python: %PY%

REM --- 檢查套件,缺了才安裝 ---
%PY% -c "import requests, PIL" 1>nul 2>nul
if errorlevel 1 (
  echo 偵測到缺少套件,開始安裝 requests 與 pillow ...
  %PY% -m pip install --upgrade pip
  %PY% -m pip install requests pillow
  if errorlevel 1 (
    echo [錯誤] 套件安裝失敗,請檢查網路,或用系統管理員身分再試一次。
    pause
    exit /b 1
  )
) else (
  echo 套件已安裝 OK
)

echo.
echo 啟動介面...
%PY% "%~dp0trellis_gui.py"
if errorlevel 1 (
  echo.
  echo 程式回報錯誤,請看上面的訊息。
  pause
)
endlocal
