@echo off
chcp 65001 >nul
echo Importing PlantDex diary into Google Drive (dates, photos, 1.txt)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0import_diary_from_plantdex.ps1"
