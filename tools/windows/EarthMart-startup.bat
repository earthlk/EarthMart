@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem [EM-STARTUP]
rem EarthMart: open the shop counter when Windows starts (put this file in shell:startup).
rem Finds the Desktop folder that holds EarthMart.html, then runs the 2-screen launcher if there is one
rem (a launcher whose file name contains " 2"), else the normal one.
rem Plain ASCII; uses only cmd built-ins (type/find, for) because findstr/powershell output break on Thai paths.
set "DESK="
for /d %%D in ("%USERPROFILE%\Desktop" "%OneDrive%\*" "%USERPROFILE%\OneDrive\*") do (
  if not defined DESK if exist "%%~fD\EarthMart.html" set "DESK=%%~fD"
)
if not defined DESK exit /b 1
set "ONE="
set "DUAL="
for %%F in ("%DESK%\EarthMart*.bat") do (
  type "%%~fF" 2>nul | find "[EM-LAUNCHER-SINGLE]" >nul
  if not errorlevel 1 (
    set "N=%%~nF"
    if not "!N: 2=!"=="!N!" (set "DUAL=%%~fF") else (set "ONE=%%~fF")
  )
)
if defined DUAL (start "" /min cmd /c ""!DUAL!" /startup" & exit /b 0)
if defined ONE (start "" /min cmd /c ""!ONE!" /startup" & exit /b 0)
exit /b 1
