// A pretend Huawei ONT (AIS) web UI: just enough of login, device list and MAC filter pages for the helper.
'use strict';
const http = require('http');
const qs = require('querystring');
module.exports = function startRouter(opts) {
  opts = opts || {};
  const st = { pass: opts.pass || 'secret', token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', sid: '', enabled: 0, policy: 0, list: [], seq: 0, posts: [],
    devices: opts.devices || [['192.168.1.20', '3C:52:82:1A:4F:09', 'POS-PC', 'Online'], ['192.168.1.34', 'A4:83:E7:22:91:BC', 'Earth-phone', 'Online'], ['192.168.1.57', 'D2:6F:3B:90:AE:14', 'HUAWEI-P30', 'Online']] };
  const hex = s => s.replace(/:/g, '\\x3a');
  const loginPage = '<html><input type="password" id="txt_Password" name="PassWord"><button id="loginbutton">Login</button></html>';
  const authed = req => st.sid && (req.headers.cookie || '').indexOf('sid=' + st.sid) >= 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const u = new URL(req.url, 'http://x');
      const send = (txt, headers) => { res.writeHead(200, Object.assign({ 'Content-Type': 'text/html' }, headers || {})); res.end(txt); };
      if (u.pathname === '/') return send(loginPage, { 'Set-Cookie': 'Cookie=body:Language:english:id=-1; path=/' });
      if (u.pathname === '/asp/GetRandCount.asp') { if (st.sid && authed(req)) { st.rand = (Date.now().toString(16) + 'f00d').padEnd(32, '9'); return send('\ufeff' + st.rand); } return send('\ufeff' + st.token); }
      if (u.pathname === '/login.cgi') {
        const f = qs.parse(body);
        const ok = f.UserName === 'admin' && Buffer.from(f.PassWord || '', 'base64').toString() === st.pass && f['x.X_HW_Token'] === st.token;
        if (!ok) return send('<script>top.location="/";</script>');
        st.sid = 'S' + Date.now().toString(36);
        return send('<script>top.location="/index.asp";</script>', { 'Set-Cookie': 'sid=' + st.sid + '; path=/' });
      }
      if (!authed(req)) return send(loginPage);
      if (u.pathname === '/index.asp') return send('<html><frame src="/html/bbsp/macfilter/macfilter.asp"><script>var menu="html/bbsp/common/lanuserinfo.asp";</script></html>');
      if (u.pathname === '/html/bbsp/common/GetLanUserDevInfo.asp') {
        return send('var UserDevinfo = new Array(' + st.devices.map(d => 'new USERDevice("InternetGatewayDevice.LANDevice.1.X_HW_UserDev.1","' + d[0] + '","' + hex(d[1]) + '","' + d[2] + '","' + d[3] + '")').join(',') + ',null);');
      }
      if (u.pathname === '/html/bbsp/macfilter/macfilter.asp') {
        st.pageToken = 'be' + Math.random().toString(16).slice(2).padEnd(14, '0') + 'c0ffee11c0ffee11c0ffee11c0ffee11';
        return send('<input type="hidden" name="onttoken" id="hwonttoken" value="' + st.pageToken + '"><script>var MacFilterRight = "' + st.enabled + '"; var MacFilterPolicy = "' + st.policy + '";\n' +
          'var MacFilter = new Array(' + st.list.map(e => 'new stMacFilter("InternetGatewayDevice.X_HW_Security.MacFilter.' + e.n + '","' + hex(e.mac) + '","' + e.name + '")').join(',') + ',null);</script>');
      }
      const f = qs.parse(body);
      st.posts.push({ path: u.pathname + u.search, body: f });
      if (!st.pageToken || f['x.X_HW_Token'] !== st.pageToken) return send('token error');
      if (u.pathname === '/html/bbsp/macfilter/add.cgi') { if (!f['x.SourceMACAddress']) return send('bad'); st.list.push({ n: ++st.seq, mac: String(f['x.SourceMACAddress']).toUpperCase(), name: f['x.DeviceAlias'] || '' }); return send('ok'); }
      if (u.pathname === '/html/bbsp/macfilter/del.cgi') { const k = Object.keys(f).find(x => x.startsWith('InternetGatewayDevice.X_HW_Security.MacFilter.')); st.list = st.list.filter(e => 'InternetGatewayDevice.X_HW_Security.MacFilter.' + e.n !== k); return send('ok'); }
      if (u.pathname === '/html/bbsp/macfilter/set.cgi') { st.enabled = Number(f['x.MacFilterRight']); st.policy = Number(f['x.MacFilterPolicy']); return send('ok'); }
      res.writeHead(404); res.end();
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, st, port: server.address().port })));
};
