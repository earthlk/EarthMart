@echo off
rem [EM-LAUNCHER-SINGLE]
setlocal EnableExtensions
rem ==================================================================
rem  EarthMart - shop counter launcher (Chrome kiosk)
rem  Keep this file next to EarthMart.html (e.g. on the Desktop).
rem  Sale screen in true kiosk mode on the main screen; receipts print without a dialog.
rem  With a customer display: use a copy named "... 2 ..." (see MODE below).
rem  Runs in its own Chrome profile (%LocalAppData%\EarthMartKiosk): normal Chrome still works.
rem  Switch to other programs: Alt+Tab or the Windows key.  Leave kiosk: Alt+F4.   Log: %TEMP%\earthmart-launch.log
rem  This file is plain ASCII on purpose (cmd misreads UTF-8 text in .bat files).
rem ==================================================================
rem MODE: single = sale screen only (true kiosk) | dual = also the customer display on the right screen.
rem A copy of this file whose NAME contains " 2" (e.g. "EarthMart ... 2 ...bat") runs dual.
rem (Decided from the file name with cmd itself: findstr/powershell cannot read Thai paths here.)
set "SELF=%~n0"
if not defined MODE set "MODE=single"
if not "%SELF: 2=%"=="%SELF%" set "MODE=dual"
set "LOG=%TEMP%\earthmart-launch.log"
echo [%date% %time%] start %* mode=%MODE% > "%LOG%"

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

rem The shop screen runs in its OWN Chrome profile (a separate Chrome), so normal Chrome
rem keeps working next to it. Only an old shop-screen Chrome is closed before starting.
set "KDIR=%LocalAppData%\EarthMartKiosk"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*EarthMartKiosk*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo KDIR=%KDIR% >> "%LOG%"
timeout /t 1 /nobreak >nul

set "COMMON=--user-data-dir="%KDIR%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --overscroll-history-navigation=0 --disable-pinch --kiosk-printing"

if /i "%MODE%"=="dual" goto :two
echo launch kiosk >> "%LOG%"
start "" "%CHROME%" %COMMON% --kiosk "%URL%"
exit /b 0

:two
rem Customer display (2nd screen, to the RIGHT of the main one): opened first so a fresh Chrome
rem honours position + full screen, then the sale screen goes full screen on the first touch.
set "PW=1920"
for /f %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width" 2^>nul') do set "PW=%%a"
echo launch two screens PW=%PW% >> "%LOG%"
start "" "%CHROME%" %COMMON% --app="%URL%?page=customer" --window-position=%PW%,0 --window-size=1024,768 --start-fullscreen
timeout /t 4 /nobreak >nul
start "" "%CHROME%" --user-data-dir="%KDIR%" --app="%URL%?kiosk=1" --window-position=0,0 --start-fullscreen
exit /b 0
