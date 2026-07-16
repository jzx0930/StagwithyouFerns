@echo off
cd /d "%~dp0"
echo === Check gltf-transform ===
where gltf-transform >nul 2>nul
if errorlevel 1 (
  echo   Installing @gltf-transform/cli ...
  call npm install -g @gltf-transform/cli
) else (
  echo   Already installed.
)
echo.
echo === Compress models (source: uncompressed subfolder) ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0optimize_models.ps1"
