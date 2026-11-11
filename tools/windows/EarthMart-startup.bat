@echo off
setlocal EnableExtensions
rem EarthMart: open the shop counter when Windows starts (put this file in shell:startup).
rem Looks on the Desktop next to EarthMart.html: uses the 2-screen launcher if it is there, else the normal one.
rem Plain ASCII on purpose.
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESK=%%D"
if not exist "%DESK%\EarthMart.html" exit /b 1
set "DUAL="
set "ONE="
for %%F in ("%DESK%\EarthMart*.bat") do (
  findstr /l /b /c:"rem [EM-LAUNCHER-DUAL]" "%%~fF" >nul && set "DUAL=%%~fF"
  findstr /l /b /c:"rem [EM-LAUNCHER-SINGLE]" "%%~fF" >nul && set "ONE=%%~fF"
)
if defined DUAL (start "" /min cmd /c ""%DUAL%" /startup" & exit /b 0)
if defined ONE (start "" /min cmd /c ""%ONE%" /startup" & exit /b 0)
