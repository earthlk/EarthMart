@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem [EM-LAUNCHER-SINGLE]
rem ==================================================================
rem  EarthMart - shop counter launcher (Chrome kiosk)
rem  Keep this file next to EarthMart.html.
rem  Sale screen in true kiosk mode on the main screen; receipts print without a dialog.
rem  A copy named "EarthMart-Counter-2Screens.bat" also opens the customer display on the RIGHT screen,
rem  "EarthMart-Counter-2Screens-Left.bat" on the LEFT screen.
rem  Runs in its own Chrome profile (%LocalAppData%\EarthMartKiosk): normal Chrome still works.
rem  Switch to other programs: Alt+Tab or the Windows key.  Leave kiosk: Alt+F4.
rem  Log: %TEMP%\earthmart-launch.log
rem  Plain ASCII on purpose (cmd misreads UTF-8 text in .bat files).
rem ==================================================================
set "SELF=%~n0"
if not defined MODE set "MODE=single"
if /i not "%SELF:2Screens=%"=="%SELF%" set "MODE=dual"
set "SIDE=right"
if /i not "%SELF:Left=%"=="%SELF%" set "SIDE=left"
set "LOG=%TEMP%\earthmart-launch.log"
echo [%date% %time%] start %* mode=%MODE% side=%SIDE% > "%LOG%"

set "HTML=%~dp0EarthMart.html"
if not exist "%HTML%" (
  echo EarthMart.html was not found next to this file.
  echo html not found >> "%LOG%"
  pause
  exit /b 1
)

rem Chrome always opens a plain-English path: %LocalAppData%\EarthMart\EarthMart.html.
rem If this launcher sits somewhere else (e.g. a Thai-named Desktop), the page is copied there first.
set "RUNDIR=%LocalAppData%\EarthMart"
if not exist "%RUNDIR%" mkdir "%RUNDIR%"
if /i not "%~dp0"=="%RUNDIR%\" (
  copy /y "%HTML%" "%RUNDIR%\EarthMart.html" >nul
  if errorlevel 1 (
    echo Could not copy EarthMart.html to %RUNDIR%
    echo copy failed >> "%LOG%"
    pause
    exit /b 1
  )
)
set "URL=file:///%RUNDIR:\=/%/EarthMart.html"
echo URL=%URL% >> "%LOG%"

rem One-time setup link left by the installer: passed to the page once, then deleted.
set "HP="
if exist "%RUNDIR%\connect.txt" (
  set /p CONNECT=<"%RUNDIR%\connect.txt"
  del "%RUNDIR%\connect.txt" >nul 2>&1
  if defined CONNECT set "HP=#!CONNECT:*#=!"
  echo setup link used >> "%LOG%"
)

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

rem Close an old shop-screen Chrome only (normal Chrome is left alone).
set "KDIR=%LocalAppData%\EarthMartKiosk"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*EarthMartKiosk*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
timeout /t 1 /nobreak >nul

set "COMMON=--user-data-dir="%KDIR%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --overscroll-history-navigation=0 --disable-pinch --kiosk-printing"

if /i "%MODE%"=="dual" goto :two
rem Customer display first (a fresh Chrome honours position + full screen), then the sale screen,
rem which goes full screen on the first touch / key. The display goes on the screen to the
rem LEFT or RIGHT of the main one (by this file's name); if there is none on that side, any other screen.
set "CX=1920"
set "CY=0"
set "CW=1024"
set "CH=768"
set "EM_SIDE=%SIDE%"
for /f "usebackq tokens=1-4" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $p=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $o=@([System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | ForEach-Object { $_.Bounds }); if ($env:EM_SIDE -eq 'left') { $s=$o | Where-Object { $_.X -lt $p.X } | Sort-Object X -Descending | Select-Object -First 1 } else { $s=$o | Where-Object { $_.X -ge $p.Right } | Sort-Object X | Select-Object -First 1 }; if (-not $s) { $s=$o | Select-Object -First 1 }; if ($s) { '{0} {1} {2} {3}' -f $s.X,$s.Y,$s.Width,$s.Height } else { '{0} 0 1024 768' -f $p.Width }" 2^>nul`) do (
  set "CX=%%a"
  set "CY=%%b"
  set "CW=%%c"
  set "CH=%%d"
)
echo launch two screens side=%SIDE% display=%CX%,%CY% %CW%x%CH% >> "%LOG%"
start "" "%CHROME%" %COMMON% --app="%URL%?page=customer" --window-position=%CX%,%CY% --window-size=%CW%,%CH% --start-fullscreen
timeout /t 4 /nobreak >nul
start "" "%CHROME%" --user-data-dir="%KDIR%" --app="%URL%?kiosk=1!HP!" --window-position=0,0 --start-fullscreen
call :trace
exit /b 0

:trace
timeout /t 5 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*EarthMartKiosk*' -and $_.CommandLine -notlike '*--type=*' } | ForEach-Object { 'CHROME-CMD: ' + ($_.CommandLine -replace '#connect=\S+', '#connect=...') } | Out-File -Append -Encoding ascii $env:TEMP\earthmart-launch.log" >nul 2>&1
exit /b 0
