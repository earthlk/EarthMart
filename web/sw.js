/*
 * EarthMart service worker: keeps the app's own files on this device so the counter opens with no internet.
 * - The page (navigation): network first, saved copy when offline. Each fresh copy also refreshes its files.
 * - Files with ?v=<version> never change, so a saved copy is used as is.
 * - Calls to the Apps Script API (another origin) are not touched.
 */
'use strict';
var CACHE = 'earthmart-v1';

function assetsOf(html, base) {
  var out = [], re = /(?:src|href)="([^"#]+)"/g, m;
  while ((m = re.exec(html))) {
    var u = new URL(m[1], base);
    if (u.origin === self.location.origin) out.push(u.href);
  }
  return out;
}

/** Save the page and every file it loads; drop old versions of those files. */
function refresh(html, pageUrl) {
  var keep = assetsOf(html, pageUrl);
  return caches.open(CACHE).then(function (c) {
    return c.keys().then(function (keys) {
      var have = keys.map(function (k) { return k.url; });
      var paths = keep.map(function (u) { return new URL(u).pathname; });
      return Promise.all(keys.filter(function (k) {
        var u = new URL(k.url);
        return u.search && keep.indexOf(k.url) < 0 && paths.indexOf(u.pathname) >= 0;   // older ?v= of a file the page still uses
      }).map(function (k) { return c.delete(k); })).then(function () {
        return Promise.all(keep.filter(function (u) { return have.indexOf(u) < 0; }).map(function (u) {
          return fetch(u).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {});
        }));
      });
    });
  });
}

self.addEventListener('install', function (e) {
  var page = new URL('./', self.registration.scope).href;
  e.waitUntil(fetch(page, { cache: 'no-store' }).then(function (r) {
    if (!r.ok) return;
    return r.clone().text().then(function (html) {
      return caches.open(CACHE).then(function (c) { return c.put(page, r); }).then(function () { return refresh(html, page); });
    });
  }).catch(function () {}).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) { return n !== CACHE && n.indexOf('earthmart-') === 0; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var page = new URL('./', self.registration.scope).href;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, { cache: 'no-store' }).then(function (r) {
      if (r.ok) {
        var copy = r.clone();
        e.waitUntil(copy.text().then(function (html) {
          return caches.open(CACHE).then(function (c) { return c.put(page, new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } })); })
            .then(function () { return refresh(html, page); });
        }));
      }
      return r;
    }).catch(function () {
      return caches.match(page).then(function (r) { return r || new Response('ออฟไลน์ และยังไม่มีหน้าร้านเก็บไว้ในเครื่องนี้', { status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' } }); });
    }));
    return;
  }

  if (url.search) {   // versioned file: saved copy first
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        if (r.ok) { var copy = r.clone(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(req, copy); })); }
        return r;
      });
    }));
    return;
  }

  // anything else (config.js, vendor files): network first, saved copy when offline
  e.respondWith(fetch(req).then(function (r) {
    if (r.ok) { var copy = r.clone(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(req, copy); })); }
    return r;
  }).catch(function () { return caches.match(req).then(function (r) { return r || Response.error(); }); }));
});
