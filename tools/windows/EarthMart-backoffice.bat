@echo off
setlocal EnableExtensions
rem ==================================================================
rem  EarthMart - back office (normal Chrome window)
rem  For printing labels on A4, editing products, reports.
rem  If the counter (kiosk) is running, press Alt+F4 there first.
rem  Plain ASCII on purpose (cmd misreads UTF-8 text in .bat files).
rem ==================================================================
set "HTML=%~dp0EarthMart.html"
if not exist "%HTML%" (
  echo EarthMart.html was not found next to this file.
  pause
  exit /b 1
)
set "URL=file:///%HTML:\=/%"
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
