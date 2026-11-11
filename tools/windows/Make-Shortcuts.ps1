# EarthMart setup helper: Desktop / Startup shortcuts. Called by Install-EarthMart.bat (reads EM_* variables).
$ErrorActionPreference = 'Stop'
$w = New-Object -ComObject WScript.Shell
$chrome = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

function Make-Link($path, $target, $desc) {
  $l = $w.CreateShortcut($path)
  $l.TargetPath = $target
  $l.WorkingDirectory = $env:EM_DIR
  $l.WindowStyle = 7          # start minimised: no black window flash
  $l.Description = $desc
  if ($chrome) { $l.IconLocation = $chrome + ',0' }
  $l.Save()
}

$desk = [Environment]::GetFolderPath('Desktop')
$startup = [Environment]::GetFolderPath('Startup')
Make-Link (Join-Path $desk 'EarthMart Counter.lnk') $env:EM_COUNTER 'EarthMart shop screen'
Make-Link (Join-Path $desk 'EarthMart Back Office.lnk') $env:EM_BACK 'EarthMart back office'
$s = Join-Path $startup 'EarthMart Counter.lnk'
if ($env:EM_AUTO -eq '1') { Make-Link $s $env:EM_COUNTER 'EarthMart shop screen at Windows start' }
elseif (Test-Path $s) { Remove-Item $s }
