// Builds one self-contained HTML file of the POS (web/ inlined) that can be opened straight from the
// computer (file://) and still talks to the Apps Script API.  Usage: node tools/build-local.js [out.html]
'use strict';
const fs = require('fs');
const path = require('path');
const WEB = path.join(__dirname, '..', 'web');
const out = process.argv[2] || path.join(__dirname, '..', 'dist', 'EarthMart-local.html');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="styles\.css[^"]*">/, () => '<style>\n' + fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8') + '\n</style>');
html = html.replace(/<script src="([^"?:]+)(\?[^"]*)?"><\/script>/g, (m, src) => {
  const f = path.join(WEB, src);
  if (!fs.existsSync(f)) throw new Error('missing ' + src);
  return '<script>/* ' + src + ' */\n' + safe(fs.readFileSync(f, 'utf8')) + '\n</script>';
});
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
html = html.replace('<head>', '<head>\n  <!-- EarthMart POS · single-file build ' + stamp + ' UTC · open this file directly; it connects to the shop\'s Apps Script -->\n  <script>window.EM_LOCAL = true; window.EM_BUILD = "' + stamp + '";</script>');
if (/<script src="(?!https?:)/.test(html) || /href="styles\.css/.test(html)) throw new Error('something was not inlined');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, Math.round(html.length / 1024) + ' KB');
