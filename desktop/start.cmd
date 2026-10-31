@echo off
rem Siqi.Work Windows launcher
rem ELECTRON_RUN_AS_NODE makes Electron run in Node mode and exit immediately.
set "ELECTRON_RUN_AS_NODE="
set "ELECTRON_NO_ATTACH_CONSOLE=1"
cd /d "%~dp0.."

set "ELECTRON=%~dp0..\node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON%" (
  echo [Siqi.Work] Electron not found, installing dependencies...
  call pnpm install
)

if not exist "dist\index.html" (
  echo [Siqi.Work] dist not found, building...
  call pnpm build
)

start "" "%ELECTRON%" .
