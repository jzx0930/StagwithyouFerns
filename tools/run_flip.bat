@echo off
chcp 65001 >nul
echo Flipping folder names:  latin-chinese  ->  chinese-latin ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0flip_names.ps1"
