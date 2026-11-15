# EarthMart - shop internet helper (runs on the counter PC, started by EarthMart-Counter.bat)
#
# Listens on http://127.0.0.1:8765 (this PC only). The EarthMart page asks it to read the router's
# connected devices and its MAC filter list, and to add / remove entries (whitelist = only listed
# devices may use the internet). It drives the router's own web pages, like a person clicking.
#
# - The router password is kept in net-config.json next to this file, encrypted for this Windows user.
# - Every request needs the key handed out when the owner first connects with the router password.
# - Router specifics (pages, form fields) live in net-profile.json so they can be fixed without code.
# - Log: %TEMP%\earthmart-net.log   Probe dump: <folder>\router-probe\
# Plain ASCII on purpose. Works on Windows PowerShell 5.1.

param(
  [int]$Port = 8765,
  [string]$Dir = '',
  [switch]$Once
)

$ErrorActionPreference = 'Stop'
$Version = '1.0'
if (-not $Dir) { $Dir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ConfigFile = Join-Path $Dir 'net-config.json'
$ProfileFile = Join-Path $Dir 'net-profile.json'
$tmp = $env:TEMP; if (-not $tmp) { $tmp = [System.IO.Path]::GetTempPath() }
$LogFile = Join-Path $tmp 'earthmart-net.log'

function Log($msg) {
  try { Add-Content -Path $LogFile -Value ('[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] ' + $msg) } catch { }
}

# ---------------------------------------------------------------- settings

function Get-Profile {
  $p = $null
  if (Test-Path $ProfileFile) { $p = Get-Content -Raw -Path $ProfileFile | ConvertFrom-Json }
  if (-not $p) { throw 'net-profile.json not found' }
  return $p
}

function Protect-Text($plain) {
  try {
    $sec = ConvertTo-SecureString -String $plain -AsPlainText -Force
    return 'dpapi:' + (ConvertFrom-SecureString -SecureString $sec)
  } catch {
    return 'b64:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($plain))
  }
}

function Unprotect-Text($stored) {
  if (-not $stored) { return '' }
  if ($stored.StartsWith('b64:')) { return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($stored.Substring(4))) }
  $sec = ConvertTo-SecureString -String $stored.Substring(6)
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

function Get-Config {
  if (Test-Path $ConfigFile) { return (Get-Content -Raw -Path $ConfigFile | ConvertFrom-Json) }
  return $null
}

function Save-Config($cfg) {
  ($cfg | ConvertTo-Json -Depth 5) | Set-Content -Path $ConfigFile -Encoding ASCII
}

# ---------------------------------------------------------------- router session

$script:Jar = $null
$script:JarAt = [DateTime]::MinValue
$script:Base = ''

function Invoke-Router([string]$method, [string]$path, [string]$body, [string]$extraCookie) {
  $url = $script:Base + $path
  $req = [System.Net.HttpWebRequest]::Create($url)
  $req.Method = $method
  $req.CookieContainer = $script:Jar
  $req.AllowAutoRedirect = $true
  $req.Timeout = 15000
  $req.UserAgent = 'Mozilla/5.0 EarthMart'
  $req.Referer = $script:Base + '/'
  if ($script:RefPage) { $req.Referer = $script:Base + $script:RefPage }
  if ($extraCookie -and $script:Jar) {
    # Put it in the jar: a hand-written Cookie header is dropped when a CookieContainer is used.
    $i = $extraCookie.IndexOf('=')
    if ($i -gt 0) {
      $c = New-Object System.Net.Cookie($extraCookie.Substring(0, $i), $extraCookie.Substring($i + 1), '/', ([Uri]$url).Host)
      $script:Jar.Add($c)
    }
  }
  if ($method -eq 'POST') {
    $bytes = [Text.Encoding]::UTF8.GetBytes([string]$body)
    $req.ContentType = 'application/x-www-form-urlencoded'
    $req.ContentLength = $bytes.Length
    $s = $req.GetRequestStream(); $s.Write($bytes, 0, $bytes.Length); $s.Close()
  }
  try { $resp = $req.GetResponse() } catch [System.Net.WebException] {
    if ($_.Exception.Response) { $resp = $_.Exception.Response } else { throw ('router not reachable: ' + $_.Exception.Message) }
  }
  $r = New-Object IO.StreamReader($resp.GetResponseStream())
  $text = $r.ReadToEnd(); $r.Close(); $resp.Close()
  return $text
}

function Decode-Js([string]$t) {
  # Huawei pages write strings like 00\x3a11\x3a22
  return [regex]::Replace($t, '\\x([0-9a-fA-F]{2})', { param($m) [char][Convert]::ToInt32($m.Groups[1].Value, 16) })
}

function Fill([string]$tpl, $vals) {
  $out = $tpl
  foreach ($k in $vals.Keys) { $out = $out.Replace('{' + $k + '}', [string]$vals[$k]) }
  return $out
}

function UrlEnc([string]$s) { return [Uri]::EscapeDataString([string]$s) }

function Get-Token($prof) {
  if ($prof.tokenUrl) {
    $t = (Invoke-Router 'POST' $prof.tokenUrl '' '').Trim()
    $t = $t.TrimStart([char]0xFEFF)
    if ($t -match '^[0-9a-fA-F]{8,}$') { return $t }
  }
  return ''
}

function Find-HexToken($prof, [string]$page, [bool]$loose) {
  $k = [regex]::Escape([string]$prof.tokenInPage)
  # <input ... id="hwonttoken" value="HEX"> (attributes in either order)
  $m = [regex]::Match($page, ('(?s)' + $k + '.{0,120}?["'']([0-9a-fA-F]{16,})["'']'))
  if (-not $m.Success) { $m = [regex]::Match($page, ('["'']([0-9a-fA-F]{16,})["''][^<>]{0,120}' + $k)) }
  if (-not $m.Success -and $loose) { $m = [regex]::Match($page, '(?i)(?:token|rand)[^"''<>\r\n]{0,40}["'']([0-9a-fA-F]{32,64})["'']') }
  if (-not $m.Success -and $loose) { $m = [regex]::Match($page, '["'']([0-9a-fA-F]{48})["'']') }
  if ($m.Success) { return $m.Groups[1].Value }
  return ''
}

function Get-PageToken($prof, [string]$page) {
  $t = Find-HexToken $prof $page $false
  if ($t) { return $t }
  Log 'page token not found, using GetRandCount'
  return (Get-Token $prof)
}

# Where a change token can come from, best guess first. The first one the router accepts is remembered.
function Token-Sources($prof) {
  $list = @('page', 'pageloose', 'home')
  foreach ($u in @($prof.changeTokenUrls)) { if ($u) { $list += ('url:' + $u) } }
  $list += 'rand'
  if ($script:GoodToken) { $list = @($script:GoodToken) + @($list | Where-Object { $_ -ne $script:GoodToken }) }
  return $list
}

function Token-From($prof, [string]$src, [string]$page) {
  if ($src -eq 'page') { return (Find-HexToken $prof $page $false) }
  if ($src -eq 'pageloose') { return (Find-HexToken $prof $page $true) }
  if ($src -eq 'home') { return (Find-HexToken $prof (Invoke-Router 'GET' $prof.homePage '' '') $true) }
  if ($src -eq 'rand') { return (Get-Token $prof) }
  if ($src.StartsWith('url:')) {
    $u = $src.Substring(4)
    foreach ($meth in @('POST', 'GET')) {
      try {
        $r = (Invoke-Router $meth $u '' '').Trim().TrimStart([char]0xFEFF)
        if ($r -match '^[0-9a-fA-F]{16,}$') { return $r }
        $t = Find-HexToken $prof $r $true; if ($t) { return $t }
      } catch { }
    }
  }
  return ''
}

function Sha256Hex([string]$s) {
  $h = [System.Security.Cryptography.SHA256]::Create()
  return (($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($s)) | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Connect-Router($cfg, [bool]$force) {
  $prof = Get-Profile
  $script:Base = 'http://' + $cfg.host
  if (-not $force -and $script:Jar -and ((Get-Date) - $script:JarAt).TotalSeconds -lt 120) { return $prof }
  $script:Jar = New-Object System.Net.CookieContainer
  $pass = Unprotect-Text $cfg.pass
  $null = Invoke-Router 'GET' $prof.loginPage '' ''
  $modes = @($prof.passModes)
  foreach ($mode in $modes) {
    $token = Get-Token $prof
    $pw = ''
    if ($mode -eq 'base64') { $pw = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pass)) }
    elseif ($mode -eq 'sha256') {
      $inner = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Sha256Hex $pass)))
      $pw = Sha256Hex ($cfg.user + $inner + $token)
    } else { $pw = $pass }
    $body = Fill $prof.loginBody @{ user = (UrlEnc $cfg.user); pass = (UrlEnc $pw); token = $token }
    $res = Invoke-Router 'POST' $prof.loginUrl $body $prof.loginCookie
    $homeHtml = Invoke-Router 'GET' $prof.homePage '' ''
    if ($homeHtml -notmatch $prof.loginPageMarker) {
      $script:JarAt = Get-Date
      Log ('login ok (' + $mode + ')')
      return $prof
    }
    Log ('login failed with ' + $mode)
  }
  $script:Jar = $null
  throw 'login failed: check the router user name and password, and close 192.168.1.1 in every browser'
}

# ---------------------------------------------------------------- reading

function Parse-Filter($prof, [string]$page) {
  $t = Decode-Js $page
  $macRx = '([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}'
  $pathRx = [regex]::Escape($prof.filterPath) + '\.(\d+)'
  $entries = @()
  $ms = [regex]::Matches($t, $pathRx)
  for ($i = 0; $i -lt $ms.Count; $i++) {
    $start = $ms[$i].Index
    $end = $t.Length; if ($i + 1 -lt $ms.Count) { $end = $ms[$i + 1].Index }
    $chunk = $t.Substring($start, [Math]::Min($end - $start, 600))
    $mac = [regex]::Match($chunk, $macRx)
    if (-not $mac.Success) { continue }
    $name = ''
    foreach ($q in [regex]::Matches($chunk, '"([^"]*)"')) {
      $v = $q.Groups[1].Value
      if ($v -and $v -notmatch $macRx -and $v -notmatch '^InternetGatewayDevice' -and $v -notmatch '^\d+$' -and $v.Length -lt 64) { $name = $v; break }
    }
    $entry = $ms[$i].Value
    if (-not ($entries | Where-Object { $_.entry -eq $entry })) {
      $entries += [pscustomobject]@{ entry = $entry; mac = $mac.Value.ToUpper().Replace('-', ':'); name = $name }
    }
  }
  $enabled = $false; $policy = ''
  $m1 = [regex]::Match($t, ($prof.enabledField + '\W{1,6}(\d)'))
  if ($m1.Success) { $enabled = ($m1.Groups[1].Value -eq '1') }
  $m2 = [regex]::Match($t, ($prof.policyField + '\W{1,6}(\d)'))
  if ($m2.Success) { if ($m2.Groups[1].Value -eq [string]$prof.policyWhitelist) { $policy = 'white' } else { $policy = 'black' } }
  return [pscustomobject]@{ enabled = $enabled; policy = $policy; entries = @($entries) }
}

function Parse-Devices([string]$page) {
  $t = Decode-Js $page
  $macRx = '([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}'
  $ipRx = '\b(\d{1,3}\.){3}\d{1,3}\b'
  $out = @()
  foreach ($chunk in ($t -split 'new |\r?\n')) {
    $mac = [regex]::Match($chunk, $macRx)
    if (-not $mac.Success) { continue }
    $ip = [regex]::Match($chunk, $ipRx)
    $name = ''
    foreach ($q in [regex]::Matches($chunk, '"([^"]*)"')) {
      $v = $q.Groups[1].Value
      if ($v -and $v -notmatch $macRx -and $v -notmatch $ipRx -and $v -notmatch '^InternetGatewayDevice' -and $v -notmatch '^(\d+|Online|Offline|ETH\d*|SSID\d*|WIFI|LAN\d*|DHCP|Static|--)$' -and $v.Length -lt 64) { $name = $v; break }
    }
    $online = $true
    if ($chunk -match '"Offline"|"0"\s*,\s*"Offline') { $online = $false }
    $m = $mac.Value.ToUpper().Replace('-', ':')
    if ($m -eq '00:00:00:00:00:00' -or ($out | Where-Object { $_.mac -eq $m })) { continue }
    $ipv = ''; if ($ip.Success) { $ipv = $ip.Value }
    $out += [pscustomobject]@{ mac = $m; ip = $ipv; name = $name; online = $online }
  }
  return @($out)
}

function Get-State($cfg) {
  $prof = Connect-Router $cfg $false
  $page = Invoke-Router 'GET' $prof.filterPage '' ''
  if ($page -match $prof.loginPageMarker) { $prof = Connect-Router $cfg $true; $page = Invoke-Router 'GET' $prof.filterPage '' '' }
  $f = Parse-Filter $prof $page
  $devs = @()
  foreach ($u in @($prof.devicesUrls)) {
    try {
      $d = Parse-Devices (Invoke-Router 'GET' $u '' '')
      foreach ($x in $d) { if (-not ($devs | Where-Object { $_.mac -eq $x.mac })) { $devs += $x } }
    } catch { Log ('devices ' + $u + ': ' + $_.Exception.Message) }
  }
  return [pscustomobject]@{ enabled = $f.enabled; policy = $f.policy; entries = $f.entries; devices = @($devs); page = $page }
}

# ---------------------------------------------------------------- changes

function Rel($p) { return $p.TrimStart('/') }

function Post-Once($cfg, $prof, [string]$urlTpl, [string]$bodyTpl, $vals, [string]$token) {
  $vals['token'] = $token
  $vals['filterPath'] = $prof.filterPath
  $vals['filterPageRel'] = Rel $prof.filterPage
  $url = Fill $urlTpl $vals
  $body = Fill $bodyTpl $vals
  Log ('POST ' + $url)
  $script:RefPage = $prof.filterPage
  try { $res = Invoke-Router 'POST' $url $body '' } finally { $script:RefPage = $null }
  $short = ($res -replace '\s+', ' ')
  $tm = [regex]::Match($short, '(?i)<title>([^<]{0,80})'); $rb = [regex]::Match($short, '(?i)<body[^>]*>(.{0,160})')
  Log ('router said: ' + $short.Length + ' chars, title=' + $tm.Groups[1].Value + ' body=' + $rb.Groups[1].Value)
  return [string]$res
}

# Send a change, trying each token source until $check says the router took it.
function Post-Change($cfg, [string]$urlTpl, [string]$bodyTpl, $vals, [scriptblock]$check) {
  $prof = Connect-Router $cfg $false
  $tried = @()
  foreach ($src in (Token-Sources $prof)) {
    $page = Invoke-Router 'GET' $prof.filterPage '' ''
    if ($page -match $prof.loginPageMarker) { $prof = Connect-Router $cfg $true; $page = Invoke-Router 'GET' $prof.filterPage '' '' }
    $token = Token-From $prof $src $page
    if (-not $token) { $tried += ($src + ':none'); continue }
    Log ('token from ' + $src + ' (' + $token.Length + ' chars)')
    $res = Post-Once $cfg $prof $urlTpl $bodyTpl $vals.Clone() $token
    if ($res -match $prof.loginPageMarker) {
      # The router dropped our session (it allows one login at a time). Log in again and resend once.
      Log 'router logged us out (is 192.168.1.1 open in a browser?) - logging in again'
      $prof = Connect-Router $cfg $true
      $page = Invoke-Router 'GET' $prof.filterPage '' ''
      $token = Token-From $prof $src $page
      if ($token) { $res = Post-Once $cfg $prof $urlTpl $bodyTpl $vals.Clone() $token }
      if ($res -match $prof.loginPageMarker) { throw 'login lost: the router keeps logging this PC out - close 192.168.1.1 in every browser' }
    }
    $after = Get-State $cfg
    if (& $check $after) {
      if ($script:GoodToken -ne $src) { Log ('token source that works: ' + $src) }
      $script:GoodToken = $src
      return $after
    }
    $tried += ($src + ':rejected')
  }
  Log ('no token source worked: ' + ($tried -join ', '))
  try {
    $dump = Join-Path $tmp 'earthmart-filterpage.txt'
    Set-Content -Path $dump -Value (Invoke-Router 'GET' $prof.filterPage '' '') -Encoding UTF8
    Log ('filter page saved to ' + $dump)
  } catch { }
  return $null
}

function Normalize-Mac([string]$mac) {
  $m = ($mac -replace '[^0-9A-Fa-f]', '').ToUpper()
  if ($m.Length -ne 12) { throw 'MAC address must have 12 hex digits' }
  return (($m -split '(..)' | Where-Object { $_ }) -join ':')
}

function Add-Entry($cfg, [string]$mac, [string]$name) {
  $prof = Get-Profile
  $mac = Normalize-Mac $mac
  $st = Get-State $cfg
  if ($st.entries | Where-Object { $_.mac -eq $mac }) { return $st }
  if ($prof.maxEntries -and $st.entries.Count -ge [int]$prof.maxEntries) { throw ('the router list is full (' + $prof.maxEntries + ')') }
  $safe = ($name -replace '[^A-Za-z0-9 _.-]', '').Trim()
  if (-not $safe) { $safe = 'EM-' + $mac.Replace(':', '').Substring(6) }
  $after = Post-Change $cfg $prof.addUrl $prof.addBody @{ mac = (UrlEnc $mac); name = (UrlEnc $safe) } { param($a) [bool]($a.entries | Where-Object { $_.mac -eq $mac }) }
  if (-not $after) { throw 'the router did not keep the new entry' }
  return $after
}

function Remove-Entry($cfg, [string]$mac) {
  $prof = Get-Profile
  $mac = Normalize-Mac $mac
  $st = Get-State $cfg
  $e = $st.entries | Where-Object { $_.mac -eq $mac } | Select-Object -First 1
  if (-not $e) { return $st }
  $after = Post-Change $cfg $prof.delUrl $prof.delBody @{ entry = $e.entry } { param($a) -not ($a.entries | Where-Object { $_.mac -eq $mac }) }
  if (-not $after) { throw 'the router did not remove the entry' }
  return $after
}

function Set-Mode($cfg, [bool]$enabled) {
  $prof = Get-Profile
  $en = '0'; if ($enabled) { $en = '1' }
  $after = Post-Change $cfg $prof.modeUrl $prof.modeBody @{ enabled = $en; policy = $prof.policyWhitelist } { param($a) $a.enabled -eq $enabled -and (-not $enabled -or $a.policy -eq 'white') }
  if (-not $after) { throw 'the router did not switch the filter as asked' }
  return $after
}

# Add a test entry and remove it again (filter stays as it is). Proves read + add + delete all work.
function Test-Router($cfg) {
  $steps = @()
  $st = Get-State $cfg
  $steps += ('read: filter ' + $(if ($st.enabled) { 'on' } else { 'off' }) + ', ' + $st.entries.Count + ' entries, ' + $st.devices.Count + ' devices seen')
  $testMac = '02:EA:57:00:00:01'
  $null = Add-Entry $cfg $testMac 'EM-TEST'
  $steps += 'add test entry: ok'
  $null = Remove-Entry $cfg $testMac
  $steps += 'remove test entry: ok'
  return $steps
}

# Save the router's pages so the page format can be checked (owner sends the folder to whoever maintains EarthMart).
function Probe-Router($cfg) {
  $prof = Connect-Router $cfg $true
  $out = Join-Path $Dir 'router-probe'
  if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }
  $seen = @{}; $queue = New-Object System.Collections.Queue
  foreach ($u in @($prof.homePage, $prof.filterPage) + @($prof.devicesUrls)) { $queue.Enqueue($u) }
  $found = @()
  while ($queue.Count -gt 0 -and $seen.Count -lt 80) {
    $u = [string]$queue.Dequeue()
    if ($seen.ContainsKey($u)) { continue }
    $seen[$u] = $true
    try { $html = Invoke-Router 'GET' $u '' '' } catch { continue }
    $file = Join-Path $out (($u.TrimStart('/') -replace '[^A-Za-z0-9._-]', '_') + '.txt')
    Set-Content -Path $file -Value $html -Encoding UTF8
    if ($html -match '(?i)macfilter|mac filter|MACAddress') { $found += $u }
    foreach ($m in [regex]::Matches($html, '["''](/?[A-Za-z0-9_/.-]+\.(asp|cgi|html))')) {
      $v = $m.Groups[1].Value; if (-not $v.StartsWith('/')) { $v = '/' + $v }
      if ($v -notmatch '(?i)logout|reboot|reset|restore|upgrade|\.cgi' -and -not $seen.ContainsKey($v)) { $queue.Enqueue($v) }
    }
  }
  return [pscustomobject]@{ folder = $out; pages = $seen.Count; macPages = @($found) }
}

# MAC addresses of this PC's network cards (so the page can protect this PC from being blocked).
function Get-LocalMacs {
  $out = @()
  try {
    foreach ($n in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
      if ($n.NetworkInterfaceType -eq 'Loopback' -or $n.OperationalStatus -ne 'Up') { continue }
      $b = $n.GetPhysicalAddress().GetAddressBytes()
      if ($b.Length -ne 6) { continue }
      $out += (($b | ForEach-Object { $_.ToString('X2') }) -join ':')
    }
  } catch { }
  return $out
}

# ---------------------------------------------------------------- tiny HTTP server

function Send($stream, [int]$code, $obj) {
  $json = '{}'; if ($obj -ne $null) { $json = ($obj | ConvertTo-Json -Depth 6 -Compress) }
  $body = [Text.Encoding]::UTF8.GetBytes($json)
  $reason = @{ 200 = 'OK'; 204 = 'No Content'; 400 = 'Bad Request'; 401 = 'Unauthorized'; 404 = 'Not Found'; 500 = 'Error' }[$code]
  $head = "HTTP/1.1 $code $reason`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($body.Length)`r`n" +
    "Access-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type, X-EM-Key`r`n" +
    "Access-Control-Allow-Private-Network: true`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $hb = [Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length); $stream.Write($body, 0, $body.Length); $stream.Flush()
}

function Read-Request($client) {
  $stream = $client.GetStream()
  $stream.ReadTimeout = 5000
  $buf = New-Object byte[] 65536
  $ms = New-Object IO.MemoryStream
  $headerEnd = -1
  while ($headerEnd -lt 0) {
    $n = $stream.Read($buf, 0, $buf.Length)
    if ($n -le 0) { break }
    $ms.Write($buf, 0, $n)
    $all = [Text.Encoding]::ASCII.GetString($ms.ToArray())
    $headerEnd = $all.IndexOf("`r`n`r`n")
  }
  if ($headerEnd -lt 0) { return $null }
  $raw = $ms.ToArray()
  $headText = [Text.Encoding]::ASCII.GetString($raw, 0, $headerEnd)
  $lines = $headText -split "`r`n"
  $first = $lines[0] -split ' '
  $headers = @{}
  foreach ($l in $lines[1..($lines.Count - 1)]) { $i = $l.IndexOf(':'); if ($i -gt 0) { $headers[$l.Substring(0, $i).Trim().ToLower()] = $l.Substring($i + 1).Trim() } }
  $len = 0; if ($headers['content-length']) { $len = [int]$headers['content-length'] }
  $bodyStart = $headerEnd + 4
  while ($raw.Length - $bodyStart -lt $len) {
    $n = $stream.Read($buf, 0, $buf.Length); if ($n -le 0) { break }
    $ms.Write($buf, 0, $n); $raw = $ms.ToArray()
  }
  $body = ''
  if ($len -gt 0) { $body = [Text.Encoding]::UTF8.GetString($raw, $bodyStart, [Math]::Min($len, $raw.Length - $bodyStart)) }
  return [pscustomobject]@{ method = $first[0]; path = ($first[1] -split '\?')[0]; headers = $headers; body = $body; stream = $stream }
}

function Public-State($st) {
  return [pscustomobject]@{ ok = $true; enabled = $st.enabled; policy = $st.policy; entries = $st.entries; devices = $st.devices; at = (Get-Date -Format 'HH:mm:ss') }
}

function Handle($rq) {
  if ($rq.method -eq 'OPTIONS') { Send $rq.stream 204 $null; return }
  $data = $null
  if ($rq.body) { try { $data = $rq.body | ConvertFrom-Json } catch { Send $rq.stream 400 @{ ok = $false; error = 'bad json' }; return } }
  $cfg = Get-Config
  if ($rq.path -eq '/ping') {
    $prof = $null; try { $prof = Get-Profile } catch { }
    $pn = ''; if ($prof) { $pn = $prof.name }
    $hostName = ''; if ($cfg) { $hostName = $cfg.host }
    Send $rq.stream 200 @{ ok = $true; version = $Version; configured = [bool]$cfg; host = $hostName; profile = $pn; localMacs = @(Get-LocalMacs) }
    return
  }
  if ($rq.path -eq '/pair') {
    if (-not $data -or -not $data.host -or -not $data.user -or -not $data.pass) { Send $rq.stream 400 @{ ok = $false; error = 'host, user and password are needed' }; return }
    $try = [pscustomobject]@{ host = [string]$data.host; user = [string]$data.user; pass = (Protect-Text ([string]$data.pass)); key = '' }
    $script:Jar = $null
    $st = Get-State $try
    $key = $cfg.key
    if (-not $key) { $key = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')) }
    $try.key = $key
    Save-Config $try
    Log ('paired with ' + $try.host)
    $o = Public-State $st; $o | Add-Member -NotePropertyName key -NotePropertyValue $key
    Send $rq.stream 200 $o
    return
  }
  if (-not $cfg) { Send $rq.stream 400 @{ ok = $false; error = 'not set up yet'; code = 'SETUP' }; return }
  if ($rq.headers['x-em-key'] -ne $cfg.key) { Send $rq.stream 401 @{ ok = $false; error = 'wrong key'; code = 'KEY' }; return }
  switch ($rq.path) {
    '/state' { Send $rq.stream 200 (Public-State (Get-State $cfg)) }
    '/allow' { Send $rq.stream 200 (Public-State (Add-Entry $cfg ([string]$data.mac) ([string]$data.name))) }
    '/block' { Send $rq.stream 200 (Public-State (Remove-Entry $cfg ([string]$data.mac))) }
    '/mode' { Send $rq.stream 200 (Public-State (Set-Mode $cfg ([bool]$data.enabled))) }
    '/test' { Send $rq.stream 200 @{ ok = $true; steps = @(Test-Router $cfg) } }
    '/probe' { $p = Probe-Router $cfg; Send $rq.stream 200 @{ ok = $true; folder = $p.folder; pages = $p.pages; macPages = $p.macPages } }
    default { Send $rq.stream 404 @{ ok = $false; error = 'not found' } }
  }
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch { Log ('port ' + $Port + ' busy - another helper is running'); exit 0 }
Log ('helper ' + $Version + ' listening on 127.0.0.1:' + $Port + ' dir=' + $Dir)
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $rq = Read-Request $client
    if ($rq) {
      try { Handle $rq } catch {
        Log ('error ' + $rq.path + ': ' + $_.Exception.Message)
        try { Send $rq.stream 500 @{ ok = $false; error = $_.Exception.Message } } catch { }
      }
    }
  } catch { Log ('request failed: ' + $_.Exception.Message) }
  finally { $client.Close() }
  if ($Once) { break }
}
