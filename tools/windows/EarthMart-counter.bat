@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem ==================================================================
rem  EarthMart - shop counter launcher (Chrome kiosk)
rem  Keep this file next to EarthMart.html (e.g. on the Desktop).
rem  1 screen : sale screen in true kiosk mode, receipts print without a dialog
rem  2 screens: customer display full screen on the RIGHT screen + sale screen
rem  Leave kiosk: Alt+F4.   Log: %TEMP%\earthmart-launch.log
rem  This file is plain ASCII on purpose (cmd misreads UTF-8 text in .bat files).
rem ==================================================================
set "LOG=%TEMP%\earthmart-launch.log"
echo [%date% %time%] start %* > "%LOG%"

set "HTML=%~dp0EarthMart.html"
echo HTML=%HTML% >> "%LOG%"
if not exist "%HTML%" (
  echo EarthMart.html was not found next to this file.
  echo Put this .bat in the same folder as EarthMart.html.
  echo html not found >> "%LOG%"
  pause
  exit /b 1
)
set "URL=file:///%HTML:\=/%"

set "CHROME="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do (
  if not defined CHROME if exist "%%~P" set "CHROME=%%~P"
)
echo CHROME=%CHROME% >> "%LOG%"
if not defined CHROME (
  echo Google Chrome was not found on this computer.
  pause
  exit /b 1
)

rem Kiosk options only work when Chrome starts fresh, so Chrome must be closed first.
tasklist /fi "imagename eq chrome.exe" 2>nul | find /i "chrome.exe" >nul
if errorlevel 1 goto :fresh
echo chrome already running >> "%LOG%"
if /i "%~1"=="/startup" goto :kill
echo.
echo  Chrome is open. It has to be closed to start the shop screen.
echo  (Tabs come back next time you open Chrome normally.)
echo.
choice /c YN /m " Close Chrome and start the shop screen now"
if errorlevel 2 exit /b 0
:kill
taskkill /im chrome.exe /f >nul 2>&1
timeout /t 2 /nobreak >nul

:fresh
rem How many screens, and how wide is the main one (the customer display goes to its right).
set "SCREENS=1"
set "PW=1920"
for /f "tokens=1,2" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $s=[System.Windows.Forms.Screen]::AllScreens; Write-Output ([string]$s.Count + ' ' + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width)" 2^>nul') do (
  set "SCREENS=%%a"
  set "PW=%%b"
)
echo SCREENS=!SCREENS! PW=!PW! >> "%LOG%"

set "COMMON=--no-first-run --no-default-browser-check --disable-session-crashed-bubble --overscroll-history-navigation=0 --disable-pinch --kiosk-printing"

if !SCREENS! GEQ 2 goto :two
echo launch kiosk >> "%LOG%"
start "" "%CHROME%" %COMMON% --kiosk "%URL%"
exit /b 0

:two
rem Customer display first (a fresh Chrome honours position + full screen), then the sale screen.
echo launch two screens >> "%LOG%"
start "" "%CHROME%" %COMMON% --app="%URL%?page=customer" --window-position=!PW!,0 --window-size=1024,768 --start-fullscreen
timeout /t 4 /nobreak >nul
start "" "%CHROME%" --app="%URL%?kiosk=1" --window-position=0,0 --start-fullscreen
exit /b 0
