@echo off
chcp 65001 >nul
echo Renaming plant folders in Google Drive...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rename_plants.ps1"
echo.
echo Renaming Platycerium cultivar folders...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rename_platycerium.ps1"
