@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0studygraph-launch.ps1" %*
exit /b %errorlevel%
