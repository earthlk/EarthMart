@echo off
setlocal EnableExtensions
rem EarthMart: open the shop counter when Windows starts.
rem Finds "EarthMart*.bat" launcher next to EarthMart.html on the Desktop (plain ASCII file).
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESK=%%D"
if not exist "%DESK%\EarthMart.html" exit /b 1
for %%F in ("%DESK%\EarthMart*.bat") do (
  findstr /c:"shop counter launcher" "%%~fF" >nul && (start "" /min cmd /c ""%%~fF" /startup" & exit /b 0)
)
