@echo off
setlocal EnableExtensions
rem ==================================================================
rem  EarthMart - back office (normal Chrome window)
rem  For printing labels on A4, editing products, reports.
rem  Opens in your normal Chrome, so it can run next to the shop screen.
rem  First time here: paste the setup link once (separate from the shop screen).
rem  Plain ASCII on purpose.
rem ==================================================================
set "HTML=%~dp0EarthMart.html"
if not exist "%HTML%" (
  echo EarthMart.html was not found next to this file.
  pause
  exit /b 1
)
set "RUNDIR=%LocalAppData%\EarthMart"
if not exist "%RUNDIR%" mkdir "%RUNDIR%"
if /i not "%~dp0"=="%RUNDIR%\" copy /y "%HTML%" "%RUNDIR%\EarthMart.html" >nul
set "URL=file:///%RUNDIR:\=/%/EarthMart.html"
set "CHROME="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do (
  if not defined CHROME if exist "%%~P" set "CHROME=%%~P"
)
if not defined CHROME (
  echo Google Chrome was not found on this computer.
  pause
  exit /b 1
)
start "" "%CHROME%" --new-window "%URL%"
