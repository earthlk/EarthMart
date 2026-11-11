# EarthMart launcher helper (called by EarthMart-Counter.bat). Keeps PowerShell out of the .bat file.
#   -Action kill            close an old shop-screen Chrome (profile EarthMartKiosk); normal Chrome is left alone
#   -Action screen -Side x  print "X Y W H" of the screen left/right of the main one (else any other screen)
#   -Action trace -Log f    append the shop-screen Chrome command lines to the log (setup link hidden)
#   -Action main -Log f     move the sale window ("EarthMart POS") to the primary screen and maximise it
#                           (Chrome opens a 2nd window wherever its last window was: the customer display)
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
  elseif ($Action -eq 'main') {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class EmWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int hh, bool r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  public static IntPtr Find(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512); GetWindowText(h, sb, 512);
      if (sb.ToString() == title) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@
    $p = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $h = [IntPtr]::Zero
    for ($i = 0; $i -lt 40 -and $h -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 500; $h = [EmWin]::Find('EarthMart POS') }
    if ($h -eq [IntPtr]::Zero) { $msg = 'main: sale window not found' }
    else {
      [void][EmWin]::ShowWindow($h, 9)          # restore (a maximised window cannot be moved)
      [void][EmWin]::MoveWindow($h, $p.X, $p.Y, $p.Width, $p.Height, $true)
      [void][EmWin]::ShowWindow($h, 3)          # maximise on the primary screen
      [void][EmWin]::SetForegroundWindow($h)
      $msg = 'main: sale window moved to ' + $p.X + ',' + $p.Y + ' ' + $p.Width + 'x' + $p.Height
    }
    if ($Log) { $msg | Out-File -Append -Encoding ascii $Log } else { Write-Output $msg }
  }
  elseif ($Action -eq 'trace' -and $Log) {
    Get-CimInstance Win32_Process -Filter "name='chrome.exe'" |
      Where-Object { $_.CommandLine -like '*EarthMartKiosk*' -and $_.CommandLine -notlike '*--type=*' } |
      ForEach-Object { 'CHROME-CMD: ' + ($_.CommandLine -replace '#connect=\S+', '#connect=...') } |
      Out-File -Append -Encoding ascii $Log
  }
} catch { Write-Output ('ERROR ' + $_.Exception.Message) }
