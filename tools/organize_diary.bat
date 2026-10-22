@echo off
chcp 65001 >nul
echo Organizing diary photos into date folders (Google Drive)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0organize_diary.ps1"
