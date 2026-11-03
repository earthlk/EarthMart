/*
 * Cash drawer control from the browser (Chrome / Edge on a PC, over HTTPS).
 *
 * The drawer plugs into the receipt printer (RJ11/RJ12). The browser sends the ESC/POS
 * "kick" command (ESC p m t1 t2) to the printer, and the printer pulses the drawer.
 *
 * Modes (saved per machine in localStorage):
 *   none   — do nothing here; let the printer driver open the drawer when a receipt prints
 *   serial — Web Serial: printers with an RS-232 or USB "virtual COM" port
 *   usb    — WebUSB: USB printers with no OS driver claiming them (on Windows, install WinUSB via Zadig)
 */
(function () {
  'use strict';

  var KEY = 'em_drawer';
  var serialPort = null;   // kept open between kicks
  var usbDev = null;
  var usbOut = null;

  function load() {
    try { return Object.assign({ mode: 'none', baud: 9600, pin: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return { mode: 'none', baud: 9600, pin: 0 }; }
  }
  function save(cfg) { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* private mode */ } }

  /** ESC p m t1 t2 — m: 0 = pin 2, 1 = pin 5; t1/t2 pulse on/off in 2 ms units. */
  function kickBytes(pin) { return new Uint8Array([0x1B, 0x70, pin ? 1 : 0, 0x19, 0xFA]); }

  function support() {
    return { serial: !!navigator.serial, usb: !!navigator.usb, secure: window.isSecureContext };
  }

  /* ----------------------------- Web Serial ----------------------------- */

  function findSerial(cfg) {
    return navigator.serial.getPorts().then(function (ports) {
      var match = ports.filter(function (p) {
        var i = p.getInfo ? p.getInfo() : {};
        return !cfg.vid || (i.usbVendorId === cfg.vid && i.usbProductId === cfg.pid);
      });
      if (!match.length) throw new Error('ไม่พบพอร์ตลิ้นชัก — กด "เลือกอุปกรณ์" ในหน้าตั้งค่าใหม่');
      return match[0];
    });
  }

  function kickSerial(cfg) {
    var ready = serialPort && serialPort.writable ? Promise.resolve(serialPort)
      : findSerial(cfg).then(function (p) {
        return p.open({ baudRate: Number(cfg.baud) || 9600 }).catch(function (e) {
          if (!/already open/i.test(e.message)) throw e;
        }).then(function () { serialPort = p; return p; });
      });
    return ready.then(function (p) {
      var w = p.writable.getWriter();
      return w.write(kickBytes(cfg.pin)).finally(function () { w.releaseLock(); });
    }).catch(function (e) { serialPort = null; throw e; });
  }

  /* ------------------------------- WebUSB ------------------------------- */

  function openUsb(dev) {
    return (dev.opened ? Promise.resolve() : dev.open())
      .then(function () { return dev.configuration ? null : dev.selectConfiguration(1); })
      .then(function () {
        var found = null;
        dev.configuration.interfaces.forEach(function (itf) {
          if (found) return;
          itf.alternates.forEach(function (alt) {
            if (found) return;
            alt.endpoints.forEach(function (ep) {
              if (!found && ep.direction === 'out' && ep.type === 'bulk') found = { itf: itf.interfaceNumber, ep: ep.endpointNumber };
            });
          });
        });
        if (!found) throw new Error('อุปกรณ์นี้ไม่มีช่องส่งข้อมูล (bulk OUT)');
        return dev.claimInterface(found.itf).then(function () { usbDev = dev; usbOut = found.ep; });
      });
  }

  function kickUsb(cfg) {
    var ready = usbDev && usbDev.opened ? Promise.resolve()
      : navigator.usb.getDevices().then(function (ds) {
        var d = ds.filter(function (x) { return !cfg.vid || (x.vendorId === cfg.vid && x.productId === cfg.pid); })[0];
        if (!d) throw new Error('ไม่พบเครื่องพิมพ์ USB — กด "เลือกอุปกรณ์" ในหน้าตั้งค่าใหม่');
        return openUsb(d);
      });
    return ready.then(function () { return usbDev.transferOut(usbOut, kickBytes(cfg.pin)); })
      .catch(function (e) { usbDev = null; throw e; });
  }

  /* ------------------------------- Public ------------------------------- */

  /** Must be called from a click (browser asks the user to pick the device). */
  function choose(mode) {
    var cfg = load();
    if (mode === 'serial') {
      if (!navigator.serial) return Promise.reject(new Error('เบราว์เซอร์นี้ไม่รองรับ Web Serial (ใช้ Chrome หรือ Edge บน PC)'));
      return navigator.serial.requestPort().then(function (p) {
        var i = p.getInfo ? p.getInfo() : {};
        serialPort = null;
        cfg.mode = 'serial'; cfg.vid = i.usbVendorId || 0; cfg.pid = i.usbProductId || 0;
        save(cfg); return cfg;
      });
    }
    if (mode === 'usb') {
      if (!navigator.usb) return Promise.reject(new Error('เบราว์เซอร์นี้ไม่รองรับ WebUSB (ใช้ Chrome หรือ Edge บน PC)'));
      return navigator.usb.requestDevice({ filters: [] }).then(function (d) {
        usbDev = null;
        cfg.mode = 'usb'; cfg.vid = d.vendorId; cfg.pid = d.productId; cfg.label = d.productName || '';
        save(cfg); return cfg;
      });
    }
    cfg.mode = 'none'; save(cfg);
    return Promise.resolve(cfg);
  }

  /** Open the drawer. Resolves true when a command was sent, false in "none" mode. */
  function open() {
    var cfg = load();
    if (cfg.mode === 'serial' && navigator.serial) return kickSerial(cfg).then(function () { return true; });
    if (cfg.mode === 'usb' && navigator.usb) return kickUsb(cfg).then(function () { return true; });
    return Promise.resolve(false);
  }

  window.CashDrawer = {
    load: load,
    save: function (patch) { var c = Object.assign(load(), patch); save(c); serialPort = null; return c; },
    choose: choose,
    open: open,
    support: support,
    kickBytes: kickBytes
  };
})();
