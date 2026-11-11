@echo off
setlocal EnableExtensions EnableDelayedExpansion
title EarthMart setup
rem ==================================================================
rem  EarthMart - set up this computer (run again any time to update / change).
rem  Copies EarthMart to %LocalAppData%\EarthMart (no admin needed), makes Desktop
rem  shortcuts, and can open the shop screen when Windows starts.
rem  Plain ASCII on purpose.
rem ==================================================================
set "SRC=%~dp0"
set "DEST=%LocalAppData%\EarthMart"
for %%F in (EarthMart.html EarthMart-Counter.bat EarthMart-BackOffice.bat Make-Shortcuts.ps1) do (
  if not exist "%SRC%%%F" (
    echo Missing %%F - keep all setup files together in one folder.
    pause
    exit /b 1
  )
)
echo.
echo  ==========================================
echo    EarthMart POS - setup for this computer
echo  ==========================================
echo.
echo  Screens:
echo    1 = sale screen only
echo    2 = sale screen + customer display on the RIGHT screen
choice /c 12 /n /m "  Choose 1 or 2: "
set "SCREENS=%errorlevel%"
echo.
choice /c YN /m "  Open the shop screen automatically when Windows starts"
set "AUTO=%errorlevel%"
echo.
echo  Setup link (optional): on a computer that already works, open
echo  Settings ^> "copy setup link for other devices", then paste it here.
echo  Press Enter to skip (you can paste it on the first screen later).
set "LINK="
set /p "LINK=  Link: "
echo.

if not exist "%DEST%" mkdir "%DEST%"
copy /y "%SRC%EarthMart.html" "%DEST%\EarthMart.html" >nul || goto :copyfail
copy /y "%SRC%EarthMart-Counter.bat" "%DEST%\EarthMart-Counter.bat" >nul || goto :copyfail
copy /y "%SRC%EarthMart-BackOffice.bat" "%DEST%\EarthMart-BackOffice.bat" >nul || goto :copyfail
copy /y "%SRC%Make-Shortcuts.ps1" "%DEST%\Make-Shortcuts.ps1" >nul || goto :copyfail
if "%SCREENS%"=="2" (
  copy /y "%SRC%EarthMart-Counter.bat" "%DEST%\EarthMart-Counter-2Screens.bat" >nul || goto :copyfail
  set "COUNTER=%DEST%\EarthMart-Counter-2Screens.bat"
) else (
  if exist "%DEST%\EarthMart-Counter-2Screens.bat" del "%DEST%\EarthMart-Counter-2Screens.bat"
  set "COUNTER=%DEST%\EarthMart-Counter.bat"
)
if defined LINK (
  echo !LINK!> "%DEST%\connect.txt"
)

rem Shortcuts (made by PowerShell, which knows where this user's Desktop / Startup folders are).
set "EM_COUNTER=%COUNTER%"
set "EM_BACK=%DEST%\EarthMart-BackOffice.bat"
set "EM_DIR=%DEST%"
set "EM_AUTO=%AUTO%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%DEST%\Make-Shortcuts.ps1"
if errorlevel 1 echo  (Could not make the shortcuts - open %DEST% and use the .bat files.)

echo  Done.
echo    Installed in : %DEST%
echo    Desktop      : "EarthMart Counter" and "EarthMart Back Office"
if "%AUTO%"=="1" (echo    Windows start: opens the shop screen) else (echo    Windows start: off)
echo.
echo  First time on the shop screen: paste the setup link (if not given above),
echo  sign in, then Settings ^> "register as counter".
echo.
choice /c YN /m "  Open the shop screen now"
if "%errorlevel%"=="1" start "" /min cmd /c ""%COUNTER%""
exit /b 0

:copyfail
echo Could not copy files to %DEST%
pause
exit /b 1
