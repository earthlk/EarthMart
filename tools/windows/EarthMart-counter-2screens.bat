@echo off
rem EarthMart - shop counter WITH customer display (2nd screen on the right).
rem Calls the counter launcher in the same folder with MODE=dual. Plain ASCII on purpose.
set "MODE=dual"
for %%F in ("%~dp0EarthMart*.bat") do (
  findstr /c:"shop counter launcher (Chrome kiosk)" "%%~fF" >nul && (call "%%~fF" %* & exit /b)
)
echo Counter launcher not found next to this file.
pause
