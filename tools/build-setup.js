// Builds the Windows setup package: EarthMart.html (single file) + launchers + installer.
// Usage: node tools/build-setup.js [outDir]   (then zip the folder; the Pages workflow does that)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const out = process.argv[2] || path.join(__dirname, '..', 'dist', 'EarthMart-Setup');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
execFileSync('node', [path.join(__dirname, 'build-local.js'), path.join(out, 'EarthMart.html')], { stdio: 'inherit' });
for (const f of ['Install-EarthMart.bat', 'EarthMart-Counter.bat', 'EarthMart-BackOffice.bat', 'EarthMart-Helper.ps1', 'Make-Shortcuts.ps1', 'README-TH.txt']) {
  fs.copyFileSync(path.join(__dirname, 'windows', f), path.join(out, f));
}
console.log('setup package in', out);
