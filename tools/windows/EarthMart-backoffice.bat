@echo off
chcp 65001 >nul
rem ==================================================================
rem  EarthMart - back office (normal Chrome window)
rem  For printing labels on A4, editing products, reports.
rem  If the counter (kiosk) is running, press Alt+F4 there first.
rem ==================================================================
set "HTML=%~dp0EarthMart.html"
set "URL=file:///%HTML:\=/%"
set "CHROME="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do (
  if not defined CHROME if exist "%%~P" set "CHROME=%%~P"
)
if not defined CHROME (
  echo ไม่พบ Google Chrome ในเครื่องนี้
  pause
  exit /b 1
)
start "" "%CHROME%" --new-window "%URL%"
