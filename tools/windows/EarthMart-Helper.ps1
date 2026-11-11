# EarthMart launcher helper (called by EarthMart-Counter.bat). Keeps PowerShell out of the .bat file.
#   -Action kill            close an old shop-screen Chrome (profile EarthMartKiosk); normal Chrome is left alone
#   -Action screen -Side x  print "X Y W H" of the screen left/right of the main one (else any other screen)
#   -Action trace -Log f    append the shop-screen Chrome command lines to the log (setup link hidden)
param([string]$Action = '', [string]$Side = 'right', [string]$Log = '')
try {
  if ($Action -eq 'kill') {
    Get-CimInstance Win32_Process -Filter "name='chrome.exe'" |
      Where-Object { $_.CommandLine -like '*EarthMartKiosk*' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }
  elseif ($Action -eq 'screen') {
    Add-Type -AssemblyName System.Windows.Forms
    $p = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $others = @([System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | ForEach-Object { $_.Bounds })
    if ($Side -eq 'left') { $s = $others | Where-Object { $_.X -lt $p.X } | Sort-Object X -Descending | Select-Object -First 1 }
    else { $s = $others | Where-Object { $_.X -ge $p.Right } | Sort-Object X | Select-Object -First 1 }
    if (-not $s) { $s = $others | Select-Object -First 1 }
    if ($s) { Write-Output ('{0} {1} {2} {3}' -f $s.X, $s.Y, $s.Width, $s.Height) }
    else { Write-Output ('{0} 0 1024 768' -f $p.Width) }
  }
  elseif ($Action -eq 'trace' -and $Log) {
    Get-CimInstance Win32_Process -Filter "name='chrome.exe'" |
      Where-Object { $_.CommandLine -like '*EarthMartKiosk*' -and $_.CommandLine -notlike '*--type=*' } |
      ForEach-Object { 'CHROME-CMD: ' + ($_.CommandLine -replace '#connect=\S+', '#connect=...') } |
      Out-File -Append -Encoding ascii $Log
  }
} catch { Write-Output ('ERROR ' + $_.Exception.Message) }
