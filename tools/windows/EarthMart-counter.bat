@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
rem ==================================================================
rem  EarthMart - shop counter launcher (Chrome kiosk)
rem  Keep this file next to EarthMart.html (on the Desktop).
rem  1 screen : sale screen in true kiosk mode, receipts print without a dialog
rem  2 screens: customer display full screen on the RIGHT screen + sale screen full screen
rem  Leave kiosk: Alt+F4
rem ==================================================================

set "HTML=%~dp0EarthMart.html"
if not exist "%HTML%" (
  echo ไม่พบไฟล์ EarthMart.html ข้างไฟล์นี้
  echo วางไฟล์นี้ไว้โฟลเดอร์เดียวกับ EarthMart.html
  pause
  exit /b 1
)
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

rem Kiosk options only work when Chrome starts fresh.
tasklist /fi "imagename eq chrome.exe" 2>nul | find /i "chrome.exe" >nul
if not errorlevel 1 (
  if /i "%~1"=="/startup" (
    taskkill /im chrome.exe /f >nul 2>&1
  ) else (
    echo Chrome เปิดอยู่ - ต้องปิด Chrome ทั้งหมดก่อนเข้าโหมดหน้าร้าน
    choice /c YN /m "ปิด Chrome แล้วเปิดหน้าร้านเลยไหม"
    if errorlevel 2 exit /b 0
    taskkill /im chrome.exe /f >nul 2>&1
  )
  timeout /t 2 /nobreak >nul
)

rem How many screens, and how wide is the main one (the customer display goes to its right).
set "SCREENS=1"
set "PW=1920"
for /f "tokens=1,2" %%a in ('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $s=[System.Windows.Forms.Screen]::AllScreens; Write-Output ([string]$s.Count + ' ' + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width)" 2^>nul') do (
  set "SCREENS=%%a"
  set "PW=%%b"
)

set "COMMON=--no-first-run --no-default-browser-check --disable-session-crashed-bubble --disable-features=TranslateUI --overscroll-history-navigation=0 --disable-pinch --kiosk-printing"

if !SCREENS! GEQ 2 (
  rem Customer display first (a fresh Chrome honours position + full screen), then the sale screen.
  start "" "%CHROME%" %COMMON% --app="%URL%?page=customer" --window-position=!PW!,0 --window-size=1024,768 --start-fullscreen
  timeout /t 4 /nobreak >nul
  start "" "%CHROME%" --app="%URL%?kiosk=1" --window-position=0,0 --start-fullscreen
) else (
  start "" "%CHROME%" %COMMON% --kiosk "%URL%"
)
exit /b 0
