// Minimal in-memory mock of the Google Apps Script services used by EarthMart POS.
'use strict';
const crypto = require('crypto');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

function coerce(v, textCol) {
  // Emulate Sheets auto-typing on write.
  if (v === null || v === undefined) return '';
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return textCol ? String(v) : v;
  const s = String(v);
  if (textCol) return s;
  if (s === 'TRUE' || s === 'true') return true;
  if (s === 'FALSE' || s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s) && !/^0\d/.test(s) && s.length < 16) return Number(s);
  return s;
}

class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const v = (this.sh.data[this.r - 1 + i] || [])[this.c - 1 + j];
        row.push(v === undefined ? '' : v);
      }
      out.push(row);
    }
    return out;
  }
  setValues(vals) {
    for (let i = 0; i < vals.length; i++) {
      this.sh.data[this.r - 1 + i] = this.sh.data[this.r - 1 + i] || [];
      for (let j = 0; j < vals[i].length; j++) {
        const col = this.c + j;
        this.sh.data[this.r - 1 + i][col - 1] = coerce(vals[i][j], this.sh.textCols.has(col));
      }
    }
    return this;
  }
  clearContent() { for (let i = 0; i < this.nr; i++) { const row = this.sh.data[this.r - 1 + i]; if (row) for (let j = 0; j < this.nc; j++) row[this.c - 1 + j] = ''; } return this; }
  setValue(v) { return this.setValues([[v]]); }
  getValue() { return this.getValues()[0][0]; }
  setFontWeight() { return this; }
  setNumberFormat(f) { if (f === '@') this.sh.textCols.add(this.c); return this; }
}

class Sheet {
  constructor(name) { this.name = name; this.data = []; this.textCols = new Set(); }
  getName() { return this.name; }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) if ((this.data[i] || []).some(v => v !== '' && v !== undefined)) return i + 1;
    return 0;
  }
  getRange(a, b, c, d) {
    if (typeof a === 'string') { const col = a.charCodeAt(0) - 64; return new Range(this, 1, col, 1, 1); }
    return new Range(this, a, b, c || 1, d || 1);
  }
  appendRow(row) { new Range(this, this.getLastRow() + 1, 1, 1, row.length).setValues([row]); }
  setFrozenRows() {}
}

class Spreadsheet {
  constructor() { this.sheets = [new Sheet('Sheet1')]; this.id = 'SS1'; }
  getId() { return this.id; }
  getName() { return 'EarthMart DB'; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

function makeContext(opts = {}) {
  const ss = new Spreadsheet();
  const props = {};
  const cache = {};
  const fetches = [];
  let clock = opts.now ? new Date(opts.now).getTime() : Date.now();

  const ctx = {
    console,
    __ss: ss, __fetches: fetches, __cache: cache, __props: props,
    __advance(ms) { clock += ms; },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
      deleteProperty: k => { delete props[k]; }
    }) },
    CacheService: { getScriptCache: () => ({
      get: k => { const e = cache[k]; if (!e || e.exp < clock) return null; return e.v; },
      put: (k, v, s) => { cache[k] = { v: String(v), exp: clock + (s || 600) * 1000 }; },
      remove: k => { delete cache[k]; }
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    Session: { getScriptTimeZone: () => 'Asia/Bangkok' },
    Logger: { log: () => {} },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, pattern) => {
        const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
        if (p.hour === '24') p.hour = '00';
        return pattern.replace(/yyyy|yy|MM|dd|HH|H|mm|ss/g, t => ({ yyyy: p.year, yy: p.year.slice(2), MM: p.month, dd: p.day, HH: p.hour, H: String(Number(p.hour)), mm: p.minute, ss: p.second })[t]);
      },
      parseCsv: s => { throw new Error('not used'); },
      sleep: () => {}
    },
    UrlFetchApp: { fetch: (url, o) => { fetches.push({ url, o }); return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
    DriveApp: {
      createFolder: n => ({ getId: () => 'F1', getFiles: () => ({ hasNext: () => false }) }),
      getFolderById: () => ({ getId: () => 'F1', getFiles: () => ({ hasNext: () => false }) }),
      getFileById: () => ({ makeCopy: (n) => ({ getName: () => n }) })
    },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => {} }) }) }) }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: t => ({ text: t, setMimeType() { return this; }, getContent() { return this.text; } })
    }
  };
  // Controllable clock for new Date()
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(clock); }
    static now() { return clock; }
  }
  ctx.Date = FakeDate;
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'gas');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

module.exports = { makeContext };
