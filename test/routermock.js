// A pretend Huawei ONT (AIS) web UI: just enough of login, device list and MAC filter pages for the helper.
'use strict';
const http = require('http');
const qs = require('querystring');
module.exports = function startRouter(opts) {
  opts = opts || {};
  const st = { ssids: opts.ssids || ['SSID-1', 'SSID-5'], macs: () => Array.from(new Set(st.list.map(e => e.mac))), pass: opts.pass || 'secret', token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', sid: '', enabled: 0, policy: 0, list: [], seq: 0, posts: [],
    devices: opts.devices || [['192.168.1.20', '3C:52:82:1A:4F:09', 'POS-PC', 'Online'], ['192.168.1.34', 'A4:83:E7:22:91:BC', 'Earth-phone', 'Online'], ['192.168.1.57', 'D2:6F:3B:90:AE:14', 'HUAWEI-P30', 'Online']] };
  const hex = s => s.replace(/:/g, '\\x3a');
  const loginPage = '<html><input type="password" id="txt_Password" name="PassWord"><button id="loginbutton">Login</button></html>';
  const waiting = '<html><head><title>Waiting...</title><script type="text/javascript">var pageName = \'/\'; top.location.replace(pageName);</script></head><body></body></html>';
  // Like the ONT: the session lives in the FIRST cookie named "Cookie" (sid=...:Language:...).
  const authed = req => { const m = (req.headers.cookie || '').match(/(?:^|;\s*)Cookie=([^;]*)/); return !!(st.sid && m && m[1].indexOf('sid=' + st.sid + ':') === 0); };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const u = new URL(req.url, 'http://x');
      const send = (txt, headers) => { res.writeHead(200, Object.assign({ 'Content-Type': 'text/html' }, headers || {})); res.end(txt); };
      if (u.pathname === '/') return send(loginPage);
      if (u.pathname === '/getCheckCode.cgi') { st.code = Math.random().toString(36).slice(2, 8); st.codes = (st.codes || 0) + 1; res.writeHead(200, { 'Content-Type': 'image/jpeg' }); return res.end(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])); }
      if (u.pathname === '/asp/GetRandCount.asp') { if (st.sid && authed(req)) { st.rand = (Date.now().toString(16) + 'f00d').padEnd(32, '9'); return send('\ufeff' + st.rand); } return send('\ufeff' + st.token); }
      if (u.pathname === '/login.cgi') {
        const f = qs.parse(body);
        const ok = f.CheckCode && f.CheckCode === st.code && (req.headers.cookie || '').indexOf('Cookie=body:Language:english:id=-1') >= 0 && f.UserName === 'admin' && Buffer.from(f.PassWord || '', 'base64').toString() === st.pass && f['x.X_HW_Token'] === st.token;
        st.code = null;
        if (!ok) return send('<script>top.location="/";</script>');
        st.sid = 'S' + Date.now().toString(36);
        return send('<script>top.location="/index.asp";</script>', { 'Set-Cookie': 'Cookie=sid=' + st.sid + ':Language:english:id=1;path=/' });
      }
      if (!authed(req)) return send(waiting);
      if (u.pathname === '/index.asp') return send('<html><frame src="/html/bbsp/wlanmacfilter/wlanmacfilter.asp"><script>var menu="html/bbsp/common/lanuserinfo.asp";</script></html>');
      if (u.pathname === '/html/bbsp/common/GetLanUserDevInfo.asp') {
        return send('var UserDevinfo = new Array(' + st.devices.map(d => 'new USERDevice("InternetGatewayDevice.LANDevice.1.X_HW_UserDev.1","' + d[0] + '","' + hex(d[1]) + '","' + d[2] + '","' + d[3] + '")').join(',') + ',null);');
      }
      if (u.pathname === '/html/ssmp/common/getRandString.asp') { st.pageToken = 'aa' + Math.random().toString(16).slice(2).padEnd(14, '0') + 'feed0001feed0001feed0001feed0001'; return send(st.pageToken); }
      if (u.pathname === '/html/amp/wificoverinfo/getTopoInfo.asp') {
        return send('[{"ApMac":"f8:de:73:5e:05:51","Width":"0.51","StaList":[' + (st.topo || []).map(d => '{HostName:"' + d[1] + '",MAC:"' + d[0].toLowerCase() + '",IP:"' + (d[2] || '') + '"}').join(',') + ']}]');
      }
      if (u.pathname === '/html/bbsp/wlanmacfilter/wlanmacfilter.asp') {
        st.pageToken = 'be' + Math.random().toString(16).slice(2).padEnd(14, '0') + 'c0ffee11c0ffee11c0ffee11c0ffee11';
        return send((st.noPageToken ? '' : '<input type="hidden" name="onttoken" id="hwonttoken" value="' + st.pageToken + '">') + '<script>function SubmitForm(){ a.push(new stSpecParaArray("x.WlanMacFilterRight", 1, 1)); b.push(new stSpecParaArray("x.WlanMacFilterPolicy", 0, 1)); }\nvar WhiteList = 0;\n' + (st.hideVars ? '' : 'var enableFilter = \'' + st.enabled + '\';\nvar Mode = \'' + st.policy + '\';\n') +
          'var WlanMacFilter = new Array(' + st.list.map(e => 'new stWlanMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.' + e.n + '","' + e.ssid + '","' + hex(e.mac) + '","' + e.name + '","1")').join(',') + ',null);</script>');
      }
      const f = qs.parse(body);
      st.posts.push({ path: u.pathname + u.search, body: f });
      if (!st.pageToken || f['x.X_HW_Token'] !== st.pageToken) return send('token error');
      if (u.pathname === '/html/bbsp/wlanmacfilter/add.cgi') {
        if (!f['x.SourceMACAddress'] || st.ssids.indexOf(f['x.SSIDName']) < 0) return send('bad');
        st.list.push({ n: ++st.seq, ssid: f['x.SSIDName'], mac: String(f['x.SourceMACAddress']).toUpperCase(), name: f['x.DeviceName'] || '' }); return send('ok');
      }
      if (u.pathname === '/html/bbsp/wlanmacfilter/del.cgi') { const ks = Object.keys(f).filter(x => x.startsWith('InternetGatewayDevice.X_HW_Security.WLANMacFilter.')); st.list = st.list.filter(e => ks.indexOf('InternetGatewayDevice.X_HW_Security.WLANMacFilter.' + e.n) < 0); return send('ok'); }
      if (u.pathname === '/html/bbsp/wlanmacfilter/set.cgi') { st.enabled = Number(f['x.WlanMacFilterRight']); st.policy = Number(f['x.WlanMacFilterPolicy']); return send('ok'); }
      res.writeHead(404); res.end();
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, st, port: server.address().port })));
};
