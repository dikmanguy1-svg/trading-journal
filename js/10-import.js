/*
 * 10-import.js — part of the Trading.Journal app script.
 *
 * Importing trades from a file (CSV or Excel .xlsx).
 * - csvRows(): reads CSV text into rows.
 * - parseBroker(): broker execution reports (buys and sells are matched into trades).
 * - xlsxRead(): a small built-in .xlsx reader (no outside library). It checks the real
 *   unzipped size so a malicious file cannot freeze the page.
 * - Sheet import: sheetDetect() finds the header row, IMW lists the column names we
 *   recognize, sheetBuild() makes trades, sheetTable() shows the preview and column matching.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

/* ---- CSV import (broker executions -> trades) ---- */
// The file being imported (preview state).
var IMP = null;
// CSV text to rows (detects , or ; or tab).
function csvRows(tx) {
  tx = String(tx).replace(/^﻿/, "");
  const first = tx.split(/\r?\n/, 1)[0] || "",
    cnt = c => (first.match(new RegExp(c === "\t" ? "\t" : "\\" + c, "g")) || []).length;
  let dl = ",";
  if (cnt(";") > cnt(dl)) dl = ";";
  if (cnt("\t") > cnt(dl)) dl = "\t";
  const R = [];
  let r = [],
    c = "",
    q = false;
  for (let i = 0; i < tx.length; i++) {
    const ch = tx[i];
    if (q) {
      if (ch === '"') {
        if (tx[i + 1] === '"') {
          c += '"';
          i++;
        } else q = false;
      } else c += ch;
    } else if (ch === '"') q = true;
    else if (ch === dl) {
      r.push(c);
      c = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && tx[i + 1] === "\n") i++;
      r.push(c);
      c = "";
      if (r.some(x => x.trim())) R.push(r);
      r = [];
      if (R.length > 60000) break;
    } else c += ch;
  }
  if (c || r.length) {
    r.push(c);
    if (r.some(x => x.trim())) R.push(r);
  }
  return R;
}
// Column names we recognize in broker reports.
const IMS = {
  sym: [
    "symbol",
    "ticker",
    "instrument",
    "security",
    "stock",
    "סימול",
    "שם נייר",
    "נייר ערך",
    "מנייה"
  ],
  dt: [
    "date/time",
    "datetime",
    "tradedate",
    "trade date",
    "tradedatetime",
    "execution time",
    "time",
    "date",
    "תאריך",
    "תאריך ביצוע"
  ],
  side: ["buy/sell", "side", "action", "type", "transaction type", "פעולה", "סוג פעולה", "סוג"],
  qty: ["quantity", "qty", "shares", "filled", "size", "כמות", "כמות מבוצעת"],
  px: [
    "t. price",
    "tradeprice",
    "trade price",
    "fill price",
    "executionprice",
    "avg. price",
    "avgprice",
    "price",
    "avg price",
    "execution price",
    "מחיר",
    "מחיר ביצוע"
  ]
};
// Read a date in many formats.
function parseDt(v) {
  v = String(v || "").trim();
  let m = v.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
  m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    let a = +m[1],
      b = +m[2],
      y = +m[3];
    if (y < 100) y += 2000;
    let d, mo;
    if (a > 12) {
      d = a;
      mo = b;
    } else if (b > 12) {
      mo = a;
      d = b;
    } else if (LANG === "he") {
      d = a;
      mo = b;
    } else {
      mo = a;
      d = b;
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  return null;
}
// Read a number with $, ₪ and thousands separators.
const pN = v => {
  v = String(v ?? "").replace(/[$₪,\s]/g, "");
  if (/^\(.*\)$/.test(v)) v = "-" + v.slice(1, -1);
  const x = parseFloat(v);
  return isFinite(x) ? x : null;
};
// Broker execution report to trades (matches buys and sells).
function parseBroker(tx) {
  const R = Array.isArray(tx) ? tx : csvRows(tx);
  if (R.length < 2) return { err: "empty" };
  let hi = -1,
    col = null;
  for (let i = 0; i < Math.min(R.length, 80) && hi < 0; i++) {
    const h = R[i].map(x => x.trim().toLowerCase()),
      f = k => {
        for (const w of IMS[k]) {
          const j = h.indexOf(w);
          if (j >= 0) return j;
        }
        return -1;
      },
      c = { sym: f("sym"), dt: f("dt"), side: f("side"), qty: f("qty"), px: f("px") };
    if (c.sym >= 0 && c.qty >= 0 && c.px >= 0 && c.dt >= 0) {
      hi = i;
      col = c;
    }
  }
  if (hi < 0) return { err: "cols" };
  const H = R[hi];
  const sect = H[1] && H[1].trim().toLowerCase() === "header" ? H[0] : null,
    disc = H.findIndex(x => x.trim().toLowerCase() === "datadiscriminator");
  const E = [];
  let skipped = 0;
  for (let i = hi + 1; i < R.length; i++) {
    const r = R[i];
    if (sect && !(r[0] === sect && String(r[1]).trim().toLowerCase() === "data")) {
      continue;
    }
    if (
      disc >= 0 &&
      String(r[disc]).trim().toLowerCase() !== "order" &&
      String(r[disc]).trim() !== ""
    ) {
      continue;
    }
    const sym = String(r[col.sym] || "")
      .trim()
      .toUpperCase();
    let q = pN(r[col.qty]),
      px = pN(r[col.px]),
      d = parseDt(r[col.dt]);
    if (!/^[A-Z0-9.\-]{1,10}$/.test(sym) || q == null || px == null || !d || q === 0 || px <= 0) {
      skipped++;
      continue;
    }
    let sg = 0;
    if (col.side >= 0) {
      const sv = String(r[col.side] || "")
        .trim()
        .toLowerCase();
      if (/^(b|buy|bot|bought|long|קנייה|קניה|קנה|קנייה\s)/.test(sv)) sg = 1;
      else if (/^(s|sell|sld|sold|short|מכירה|מכר)/.test(sv)) sg = -1;
    }
    if (!sg) sg = q < 0 ? -1 : 1;
    E.push({ sym, d, q: Math.abs(q) * sg, px, i });
  }
  E.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.i - b.i));
  const L = {},
    T = [];
  for (const e of E) {
    const Q = (L[e.sym] = L[e.sym] || []);
    let rem = e.q;
    const sgn = Math.sign(rem);
    while (rem !== 0) {
      if (!Q.length || Math.sign(Q[0].q) === sgn) {
        Q.push({ q: rem, px: e.px, d: e.d });
        rem = 0;
      } else {
        const lot = Q[0],
          m = Math.min(Math.abs(lot.q), Math.abs(rem));
        T.push({
          t: e.sym,
          d: lot.d,
          dir: lot.q > 0 ? "Long" : "Short",
          e: lot.px,
          sh: m,
          x: e.px
        });
        lot.q -= Math.sign(lot.q) * m;
        rem -= sgn * m;
        if (Math.abs(lot.q) < 1e-9) Q.shift();
      }
    }
  }
  for (const k of Object.keys(L))
    for (const lot of L[k])
      T.push({
        t: k,
        d: lot.d,
        dir: lot.q > 0 ? "Long" : "Short",
        e: lot.px,
        sh: Math.abs(lot.q),
        x: null
      });
  return { T, n: E.length, skipped };
}
/* ---- .xlsx reader. No outside library (so nothing new to allow in the CSP): an .xlsx file is a zip of XML files.
   We unzip it with the browser's own DecompressionStream and read the XML with DOMParser. Everything stays on the device. ---- */
// Read an .xlsx file (built in, no outside library; size checked while unzipping).
async function xlsxRead(buf) {
  const u = new Uint8Array(buf),
    dv = new DataView(buf),
    td = new TextDecoder();
  let eo = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 66000); i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      eo = i;
      break;
    }
  if (eo < 0) throw new Error("zip");
  const n = dv.getUint16(eo + 10, true),
    F = {};
  let p = dv.getUint32(eo + 16, true);
  for (let k = 0; k < n && k < 5000; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("zip");
    const nl = dv.getUint16(p + 28, true);
    F[td.decode(u.subarray(p + 46, p + 46 + nl))] = {
      m: dv.getUint16(p + 10, true),
      cs: dv.getUint32(p + 20, true),
      us: dv.getUint32(p + 24, true),
      lo: dv.getUint32(p + 42, true)
    };
    p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  let tot = 0;
  const get = async nm => {
    const f = F[nm];
    if (!f) return null;
    if ((tot += f.us) > 8e7) throw new Error("big");
    const st = f.lo + 30 + dv.getUint16(f.lo + 26, true) + dv.getUint16(f.lo + 28, true),
      d = u.subarray(st, st + f.cs);
    if (f.m === 0) return td.decode(d);
    if (f.m !== 8) throw new Error("zip");
    const rd = new Blob([d])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"))
        .getReader(),
      ch = [];
    let got = 0;
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      if ((got += value.length) > f.us) {
        try {
          await rd.cancel();
        } catch (x) {}
        throw new Error("big");
      }
      ch.push(value);
    }
    return new Blob(ch).text();
  };
  const X = t => new DOMParser().parseFromString(t, "application/xml"),
    tags = (el, nm) => [...el.getElementsByTagNameNS("*", nm)],
    txt = el =>
      tags(el, "t")
        .map(x => x.textContent)
        .join("");
  const wb = await get("xl/workbook.xml");
  if (!wb) throw new Error("zip");
  const rl = await get("xl/_rels/workbook.xml.rels"),
    R = {};
  if (rl)
    for (const r of tags(X(rl), "Relationship")) {
      const t = r.getAttribute("Target") || "";
      R[r.getAttribute("Id")] = t.startsWith("/") ? t.slice(1) : "xl/" + t;
    }
  const ss = await get("xl/sharedStrings.xml"),
    SS = ss ? tags(X(ss), "si").map(txt) : [],
    out = [];
  for (const s of tags(X(wb), "sheet").slice(0, 60)) {
    const id = [...s.attributes].find(a => a.localName === "id" && a.name !== "sheetId"),
      path = id && R[id.value];
    if (!path) continue;
    const x = await get(path);
    if (!x) continue;
    const rows = [];
    for (const row of tags(X(x), "row").slice(0, 60000)) {
      const ri = (+row.getAttribute("r") || rows.length + 1) - 1;
      if (ri >= 60000) break;
      const a = [];
      let ci = 0;
      for (const c of tags(row, "c")) {
        const ref = c.getAttribute("r");
        if (ref) {
          const L = ref.match(/^[A-Z]+/);
          if (L) {
            ci = 0;
            for (const ch of L[0]) ci = ci * 26 + ch.charCodeAt(0) - 64;
            ci--;
          }
        }
        if (ci >= 200) break;
        const t = c.getAttribute("t"),
          v = tags(c, "v")[0];
        let val = "";
        if (t === "s") val = v ? (SS[+v.textContent] ?? "") : "";
        else if (t === "inlineStr") val = tags(c, "is").map(txt).join("");
        else if (t === "b") val = v && v.textContent === "1" ? "TRUE" : "FALSE";
        else if (t !== "e" && v) val = v.textContent;
        a[ci++] = val;
      }
      rows[ri] = Array.from(a, x => x ?? "");
    }
    out.push({
      name: s.getAttribute("name") || "",
      R: Array.from(rows, r => r || []).filter(r => r.some(c => String(c).trim()))
    });
  }
  return out;
}
// Pick the sheet that looks like a trade journal.
function impSheets(name, SH) {
  let best = null;
  for (const sh of SH) {
    const d = sheetDetect(sh.R);
    if (d && (!best || d.n > best.d.n || (d.n === best.d.n && d.D.length > best.d.D.length)))
      best = { d, sh };
  }
  if (best) {
    IMP = {
      mode: "sheet",
      name: name + (SH.length > 1 && best.sh.name ? " · " + best.sh.name : ""),
      ...best.d,
      ov: {},
      off: {},
      mo: true
    };
    sheetBuild();
    return;
  }
  for (const sh of SH) {
    const r = parseBroker(sh.R);
    if (!r.err) return impBroker(name, r);
  }
  IMP = { err: SH.some(s => s.R.length > 1) ? "cols" : "empty", name };
}
// Start an import from CSV text.
function impMake(file, tx) {
  impSheets(file.name, [{ name: "", R: csvRows(tx) }]);
}
// Import from a broker report (skips trades that already exist).
function impBroker(name, r) {
  const key = t =>
      [
        t.t,
        t.d,
        Number(t.e).toFixed(4),
        Number(t.sh).toFixed(4),
        t.x == null ? "o" : Number(t.x).toFixed(4)
      ].join("|"),
    have = new Set(S.trades.map(key));
  let dup = 0;
  const T = [];
  for (const t of r.T) {
    if (have.has(key(t))) {
      dup++;
      continue;
    }
    have.add(key(t));
    T.push(t);
  }
  IMP = { T, n: r.n, skipped: r.skipped, dup, name };
}
// HTML of the import preview.
function impTable() {
  if (!IMP) return "";
  if (IMP.mode === "sheet") return sheetTable();
  const he = LANG === "he",
    I = IMP;
  if (I.err)
    return `<p class="neg" role="alert">${I.err === "fmt" ? (he ? "לא הצלחנו לקרוא את הקובץ. שמור אותו כ-xlsx (אקסל) או כ-CSV ונסה שוב. קבצי xls ישנים לא נתמכים." : "We could not read this file. Save it as .xlsx (Excel) or CSV and try again. Old .xls files are not supported.") : I.err === "cols" ? (he ? "לא זיהינו את העמודות בקובץ. קובץ יומן צריך לפחות תאריך כניסה, טיקר, מחיר כניסה וכמות (ועוד מחיר יציאה, סטופ או יעד). קובץ ברוקר צריך עמודות של סימול, תאריך, כמות ומחיר (ועמודת קנייה/מכירה אם הכמות אינה שלילית במכירה)." : "We could not recognize the columns in this file. A journal file needs at least Entry date, Ticker, Entry price and Shares (plus Exit price, Stop or Target). A broker file needs Symbol, Date, Quantity and Price columns (and Buy/Sell if sells are not negative quantities).") : he ? "הקובץ ריק או לא קריא." : "This file is empty or unreadable."}</p><button class="gh sm" data-a="imno">${he ? "סגירה" : "Close"}</button>`;
  const cl = I.T.filter(t => t.x != null).length,
    op = I.T.length - cl;
  return `<p><b>${esc(I.name)}</b>: ${he ? `נקראו ${I.n} ביצועים, נוצרו ${I.T.length} עסקאות (${cl} סגורות, ${op} פתוחות)` : `${I.n} executions read, ${I.T.length} trades built (${cl} closed, ${op} open)`}${I.dup ? (he ? `. דולגו ${I.dup} כפולות` : `. Skipped ${I.dup} duplicates`) : ""}${I.skipped ? (he ? `. ${I.skipped} שורות לא נקראו` : `. ${I.skipped} rows could not be read`) : ""}.</p><div class="wrap" tabindex="0" role="region" aria-label="Preview, scrollable"><table><thead><tr><th>Date</th><th>Ticker</th><th>Side</th><th>Entry</th><th>Shares</th><th>Exit</th><th>P&amp;L</th></tr></thead><tbody>${I.T.slice(
    0,
    8
  )
    .map(
      t =>
        `<tr><td>${esc(t.d)}</td><td>${esc(t.t)}</td><td>${t.dir}</td><td>${$f(t.e, 2)}</td><td>${t.sh}</td><td>${t.x == null ? "open" : $f(t.x, 2)}</td><td>${t.x == null ? "–" : $f(pnl(t), 2)}</td></tr>`
    )
    .join(
      ""
    )}</tbody></table></div>${I.T.length > 8 ? `<p class="mut sm">${he ? `מוצגות 8 מתוך ${I.T.length}` : `Showing 8 of ${I.T.length}`}</p>` : ""}<p class="mut sm">${he ? "בדוק שהתאריכים והכיוון נכונים לפני הייבוא. אפשר למחוק עסקאות אחר כך." : "Check that the dates and direction look right before importing. You can delete trades afterwards."}</p><p>${I.T.length ? `<button data-a="imok">${he ? `ייבא ${I.T.length} עסקאות` : `Import ${I.T.length} trades`}</button> ` : ""}<button class="gh" data-a="imno">${he ? "ביטול" : "Cancel"}</button></p>`;
}
/* ---- Sheet import (Google Sheets / Excel journal CSV -> trades, with column matching) ---- */
// Journal fields that can be matched to file columns.
const IMF = [
  ["d", "Entry date"],
  ["t", "Ticker"],
  ["dir", "Direction"],
  ["e", "Entry price"],
  ["s", "Stop"],
  ["tg", "Target"],
  ["sh", "Shares"],
  ["th", "Reason for entry"],
  ["x", "Exit price"],
  ["xd", "Exit date"],
  ["rs", "Exit type"],
  ["xr", "Reason for exit"],
  ["m", "Mindset (1-5)"],
  ["ls", "Lessons / notes"],
  ["pl", "P&L (check only)"]
];
// Hebrew names of those fields.
const IMFH = {
  d: "תאריך כניסה",
  t: "טיקר",
  dir: "כיוון",
  e: "מחיר כניסה",
  s: "סטופ",
  tg: "יעד",
  sh: "כמות",
  th: "סיבת כניסה",
  x: "מחיר יציאה",
  xd: "תאריך יציאה",
  rs: "סוג יציאה",
  xr: "סיבת יציאה",
  m: "מצב רוח (1-5)",
  ls: "לקחים / הערות",
  pl: "רווח/הפסד (לבדיקה בלבד)"
};
// Column names we recognize for each field.
const IMW = {
  d: [
    "entry date",
    "date",
    "open date",
    "opened",
    "date opened",
    "buy date",
    "trade date",
    "תאריך",
    "תאריך כניסה",
    "תאריך פתיחה",
    "תאריך קנייה",
    "תאריך קניה"
  ],
  t: [
    "ticker",
    "symbol",
    "stock",
    "instrument",
    "security",
    "טיקר",
    "סימול",
    "מניה",
    "מנייה",
    "נייר",
    "נייר ערך",
    "שם נייר"
  ],
  dir: [
    "direction",
    "side",
    "long short",
    "position",
    "כיוון",
    "צד",
    "לונג שורט",
    "סוג עסקה",
    "פוזיציה"
  ],
  e: [
    "entry price",
    "entry",
    "buy price",
    "open price",
    "avg entry",
    "average entry",
    "price in",
    "מחיר כניסה",
    "כניסה",
    "מחיר קנייה",
    "מחיר קניה",
    "שער כניסה"
  ],
  s: [
    "original stop",
    "stop",
    "stop loss",
    "stoploss",
    "sl",
    "stop price",
    "initial stop",
    "סטופ",
    "סטופ לוס",
    "סטופ מקורי",
    "סטופ התחלתי",
    "מחיר סטופ",
    "עצירת הפסד"
  ],
  tg: [
    "target price",
    "target",
    "take profit",
    "tp",
    "price target",
    "יעד",
    "מחיר יעד",
    "טייק פרופיט",
    "מטרה"
  ],
  sh: [
    "shares",
    "quantity",
    "qty",
    "size",
    "units",
    "כמות",
    "מניות",
    "מספר מניות",
    "כמות מניות",
    "יחידות"
  ],
  th: [
    "thesis entry reasons",
    "thesis",
    "entry reason",
    "entry reasons",
    "reason for entry",
    "reasons",
    "setup",
    "סיבת כניסה",
    "סיבות כניסה",
    "תזה",
    "תזה סיבות כניסה",
    "סיבה"
  ],
  x: [
    "exit price",
    "exit",
    "close price",
    "sell price",
    "price out",
    "מחיר יציאה",
    "יציאה",
    "מחיר מכירה",
    "מחיר סגירה",
    "שער יציאה"
  ],
  xd: [
    "exit date",
    "close date",
    "closed",
    "date closed",
    "sell date",
    "תאריך יציאה",
    "תאריך סגירה",
    "תאריך מכירה"
  ],
  rs: ["exit reason", "exit type", "result", "outcome", "סוג יציאה", "סיבת יציאה", "תוצאה"],
  xr: ["reason for exit", "exit notes", "exit comment", "סיבת היציאה", "הערות יציאה"],
  m: [
    "mindset",
    "mind",
    "mental",
    "emotion",
    "mood",
    "מצב רוח",
    "מצב מנטלי",
    "ציון מנטלי",
    "מיינדסט"
  ],
  ls: [
    "lessons notes",
    "lessons",
    "notes",
    "note",
    "comments",
    "lesson",
    "לקחים",
    "הערות",
    "לקחים הערות",
    "לקח"
  ],
  pl: [
    "p&l",
    "pnl",
    "p l",
    "profit",
    "profit loss",
    "net p&l",
    "realized p&l",
    "רווח הפסד",
    "רווח והפסד",
    "רווח"
  ]
};
// Normalize a column name for matching.
const imN = s =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9֐-׿&]+/g, " ")
    .trim();
// Find the header row and match columns automatically.
function sheetDetect(R) {
  let best = null;
  for (let i = 0; i < Math.min(R.length, 30); i++) {
    const H = R[i].map(imN),
      map = {},
      used = new Set();
    for (const [f] of IMF)
      for (const w of IMW[f]) {
        const j = H.findIndex((h, k) => h === w && !used.has(k));
        if (j >= 0) {
          map[f] = j;
          used.add(j);
          break;
        }
      }
    const n = Object.keys(map).length;
    if (
      map.t != null &&
      map.e != null &&
      map.d != null &&
      (map.x != null || map.s != null || map.tg != null || map.th != null) &&
      (!best || n > best.n)
    )
      best = { n, hi: i, map };
  }
  if (!best) return null;
  const H = R[best.hi].map(x => String(x ?? "").trim()),
    D = R.slice(best.hi + 1)
      .filter(r => r.some(c => String(c).trim()))
      .slice(0, 5000);
  return { H, D, map: best.map, n: best.n };
}
// Is this a real date.
const okD = (y, m, d) => {
  if (!(y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null;
};
// Guess day/month order from the dates in a column.
function dOrder(vals) {
  let dm = 0,
    md = 0;
  for (const v of vals) {
    const m = String(v ?? "")
      .trim()
      .match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-]\d{2,4}/);
    if (m) {
      if (+m[1] > 12) dm++;
      if (+m[2] > 12) md++;
    }
  }
  return dm > md ? "dmy" : md > dm ? "mdy" : null;
}
// Read a date cell (Excel serial numbers too).
function imDate(v, ord) {
  v = String(v ?? "").trim();
  if (!v) return null;
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const n = Math.floor(+v);
    if (n > 25000 && n < 75000)
      return new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10);
  }
  const m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (m && ord) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return ord === "mdy" ? okD(y, +m[1], +m[2]) : okD(y, +m[2], +m[1]);
  }
  const r = parseDt(v);
  if (r) return okD(+r.slice(0, 4), +r.slice(5, 7), +r.slice(8, 10));
  if (/[a-z]/i.test(v)) {
    const t = new Date(v);
    if (!isNaN(t)) return okD(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  return null;
}
/* Exit date. A full date is used as is. A short "day.month" value (a number typed into a sheet, so 22.10 becomes 22.1)
   gets its year from the entry date: we take the earliest matching date on or after entry, and never in the future. */
// Read an exit date cell.
function imXd(v, ord, ed) {
  v = String(v ?? "").trim();
  if (!v) return { xd: "" };
  const full = imDate(v, ord);
  if (full) return ed && full < ed ? { xd: "", bad: 1 } : { xd: full };
  const m = v.match(/^(\d{1,2})([.\/\-])(\d{1,2})$/);
  if (!m || !ed) return { xd: "", bad: 1 };
  const md = ord === "mdy" && m[2] !== ".",
    d = +(md ? m[3] : m[1]),
    mo = +(md ? m[1] : m[3]),
    ms = [mo];
  if (m[2] === "." && m[3] === "1") ms.push(10);
  const y = +ed.slice(0, 4),
    today = dkey(new Date()),
    c = [];
  for (const yy of [y, y + 1])
    for (const mm of ms) {
      const x = okD(yy, mm, d);
      if (x && x >= ed && x <= today) c.push(x);
    }
  c.sort();
  return c.length ? { xd: c[0] } : { xd: "", bad: 1 };
}
// Long or Short from text.
const imDir = v => (/^(short|sell|sold|sld|s$|שורט|מכירה)/.test(imN(v)) ? "Short" : "Long");
// Exit reason from text.
const imRs = v => {
  const r = rsN(v);
  if (r) return r;
  const h = String(v || "");
  return /יעד|טרגט|מטרה/.test(h)
    ? RSL[0]
    : /סטופ/.test(h)
      ? RSL[1]
      : /איזון|ברייק/.test(h)
        ? RSL[2]
        : /ידני/.test(h)
          ? RSL[3]
          : "";
};
// Guess the exit reason from the prices.
const autoRs = t =>
  Math.abs(t.x - t.e) <= t.e * 0.002
    ? RSL[2]
    : t.s != null && (t.dir === "Long" ? t.x <= t.s : t.x >= t.s)
      ? RSL[1]
      : t.tg != null && (t.dir === "Long" ? t.x >= t.tg : t.x <= t.tg)
        ? RSL[0]
        : RSL[3];
// A key that identifies a trade (to skip duplicates).
const tKey = t =>
  [
    t.t,
    t.d,
    Number(t.e).toFixed(4),
    Number(t.sh).toFixed(4),
    t.x == null ? "o" : Number(t.x).toFixed(4)
  ].join("|");
// Build trades from the matched columns.
function sheetBuild() {
  const I = IMP,
    M = I.map,
    col = f => (M[f] == null ? null : M[f]),
    ord = {};
  for (const f of ["d", "xd"]) if (col(f) != null) ord[f] = dOrder(I.D.map(r => r[M[f]]));
  const lK = t => [t.t, t.d, Number(t.e).toFixed(2), Number(t.sh).toFixed(2)].join("|"),
    have = new Map(S.trades.map(t => [lK(t), t])),
    seen = new Set();
  I.rows = I.D.map((r, i) => {
    const ov = I.ov[i] || {},
      g = f =>
        ov[f] != null ? String(ov[f]).trim() : col(f) == null ? "" : String(r[col(f)] ?? "").trim();
    const t = g("t").toUpperCase().replace(/\s+/g, ""),
      eR = g("e"),
      dR = g("d");
    if (!t && !eR && !dR) return null;
    const W = [],
      o = {
        d: null,
        t,
        dir: imDir(g("dir")),
        e: pN(eR),
        s: pN(g("s")),
        tg: pN(g("tg")),
        sh: pN(g("sh")),
        x: pN(g("x")),
        xd: "",
        rs: "",
        xr: g("xr").slice(0, 2000),
        m: null,
        th: g("th").slice(0, 2000),
        ls: g("ls").slice(0, 2000)
      };
    o.d = ov.d != null ? imDate(ov.d) : imDate(dR, ord.d);
    for (const k of ["s", "tg", "x"]) if (o[k] != null && !(o[k] > 0)) o[k] = null;
    const mm = pN(g("m"));
    o.m = mm != null && mm >= 1 && mm <= 5 ? mm : null;
    let err = !/^[A-Z0-9.\-]{1,10}$/.test(t)
      ? "t"
      : !o.d
        ? "d"
        : !(o.e > 0)
          ? "e"
          : !(o.sh > 0)
            ? "sh"
            : "";
    if (o.x != null) {
      const xv = ov.xd != null ? { xd: imDate(ov.xd) || "" } : imXd(g("xd"), ord.xd, o.d);
      o.xd = xv.xd;
      if (xv.bad || (o.xd && o.d && o.xd < o.d)) W.push("xd");
      const rv = g("rs");
      if (rv && !/open|פתוח/i.test(rv)) {
        o.rs = imRs(rv);
        if (!o.rs && !o.xr) o.xr = rv.slice(0, 2000);
      }
      if (!o.rs && !err) o.rs = autoRs(o);
    }
    if (o.s != null && o.e > 0 && (o.dir === "Long" ? o.s >= o.e : o.s <= o.e)) W.push("stop");
    const pl = pN(g("pl"));
    if (!err && pl != null && o.x != null) {
      const p = pnl(o);
      if (Math.abs(p - pl) > Math.max(1, Math.abs(pl) * 0.01)) {
        W.push("pl");
        o._pl = pl;
      }
    }
    let dup = false,
      fill = null;
    if (!err) {
      const k = tKey(o),
        ex = have.get(lK(o));
      dup = !!ex || seen.has(k);
      seen.add(k);
      if (ex && ex.x != null && !ex.xd && o.xd) fill = ex.id;
    }
    return { i, o, err, W, dup, fill };
  }).filter(Boolean);
  I.T = I.rows.filter(r => !r.err && !r.dup && !I.off[r.i]).map(r => r.o);
  I.F = I.rows.filter(r => r.fill && !I.off[r.i]).map(r => [r.fill, r.o.xd]);
}
// Handle changes in the column-matching screen.
function impEdit(el) {
  const I = IMP;
  if (!I || I.mode !== "sheet") return;
  const a = el.dataset.im,
    f = el.dataset.f;
  if (a === "map") {
    const j = el.value === "" ? null : +el.value;
    for (const k of Object.keys(I.map)) if (j != null && I.map[k] === j) delete I.map[k];
    if (j == null) delete I.map[f];
    else I.map[f] = j;
  } else if (a === "ov") {
    const i = +el.dataset.i;
    (I.ov[i] = I.ov[i] || {})[f] = el.value;
  } else if (a === "inc") {
    const i = +el.dataset.i;
    if (el.checked) delete I.off[i];
    else I.off[i] = 1;
  }
  sheetBuild();
}
// HTML of the sheet import preview and column matching.
function sheetTable() {
  const he = LANG === "he",
    I = IMP,
    L = (en, h) => (he ? h : en),
    rows = I.rows,
    ok = rows.filter(r => !r.err && !r.dup),
    err = rows.filter(r => r.err).length,
    dup = rows.filter(r => r.dup).length,
    wn = ok.filter(r => r.W.length).length,
    cl = I.T.filter(t => t.x != null).length,
    op = I.T.length - cl,
    need = ["d", "t", "e", "sh"].filter(f => I.map[f] == null),
    EM = {
      t: L("Missing ticker", "חסר טיקר"),
      d: L("Missing or unclear entry date", "תאריך כניסה חסר או לא ברור"),
      e: L("Missing entry price", "חסר מחיר כניסה"),
      sh: L("Missing shares", "חסרה כמות")
    },
    WM = {
      xd: L("Check the exit date", "בדוק את תאריך היציאה"),
      stop: L("Stop is on the wrong side of entry", "הסטופ בצד הלא נכון של מחיר הכניסה"),
      pl: L("P&L differs from your sheet", "הרווח/הפסד שונה מהגיליון")
    },
    inp = (r, f, v, c) =>
      `<input class="ti${c ? " " + c : ""}" data-im="ov" data-f="${f}" data-i="${r.i}" value="${esc(v ?? "")}"${c ? " readonly" : ""} aria-label="${esc((he ? IMFH[f] : IMF.find(x => x[0] === f)[1]) + " " + r.o.t)}">`,
    sh = rows.slice(0, 300);
  return `<p><b>${esc(I.name)}</b>: ${L(`${rows.length} rows read. Ready to import: ${I.T.length} trade${I.T.length === 1 ? "" : "s"} (${cl} closed, ${op} open)`, `נקראו ${rows.length} שורות. מוכנות לייבוא: ${I.T.length} עסקאות (${cl} סגורות, ${op} פתוחות)`)}${dup ? L(`. ${dup} already in your journal`, `. ${dup} כבר ביומן`) : ""}${err ? L(`. ${err} rows cannot be read`, `. ${err} שורות לא נקראו`) : ""}${I.F.length ? L(`. Exit dates to add to trades already in your journal: ${I.F.length}`, `. תאריכי יציאה שיתווספו לעסקאות שכבר ביומן: ${I.F.length}`) : ""}${wn ? L(`. ${wn} need a look`, `. ${wn} כדאי לבדוק`) : ""}.</p>
<details class="imd"${I.mo ? " open" : ""}><summary>${L("Column matching", "התאמת עמודות")}${need.length ? ` <span class="neg">(${L("missing", "חסר")}: ${need.map(f => (he ? IMFH[f] : IMF.find(x => x[0] === f)[1])).join(", ")})</span>` : ""}</summary><p class="mut sm">${L("We matched the columns of your file automatically. If something is wrong, pick the right column. Calculated columns (risk, R, live price) are not needed: the site calculates them.", "התאמנו את העמודות בקובץ שלך אוטומטית. אם משהו לא נכון, בחר את העמודה הנכונה. עמודות מחושבות (סיכון, R, מחיר חי) לא נדרשות: האתר מחשב אותן לבד.")}</p>
<div class="imm">${IMF.map(([f, l]) => `<label>${he ? IMFH[f] : l}<select data-im="map" data-f="${f}" data-nt><option value="">${L("— not imported —", "— לא מיובא —")}</option>${I.H.map((h, j) => `<option value="${j}"${I.map[f] === j ? " selected" : ""}>${esc(h || L("Column ", "עמודה ") + (j + 1))}</option>`).join("")}</select></label>`).join("")}</div></details>
<h3 style="margin:14px 0 4px">${L("Preview", "תצוגה מקדימה")}</h3><p class="mut sm">${L("You can fix any cell here before importing. Untick a row to leave it out.", "אפשר לתקן כל תא כאן לפני הייבוא. בטל את הסימון בשורה כדי לא לייבא אותה.")}</p>
<div class="wrap imp-p" tabindex="0" role="region" aria-label="${L("Preview, scrollable", "תצוגה מקדימה, ניתן לגלול")}"><table><thead><tr><th></th><th>${L("Status", "מצב")}</th><th>${L("Entry date", "תאריך כניסה")}</th><th>${L("Ticker", "טיקר")}</th><th>${L("Side", "כיוון")}</th><th>${L("Entry", "כניסה")}</th><th>${L("Stop", "סטופ")}</th><th>${L("Target", "יעד")}</th><th>${L("Shares", "כמות")}</th><th>${L("Exit", "יציאה")}</th><th>${L("Exit date", "תאריך יציאה")}</th><th>${L("Exit type", "סוג יציאה")}</th><th>P&amp;L</th><th>${L("Mind", "מצב רוח")}</th></tr></thead><tbody>
${sh
  .map(r => {
    const o = r.o,
      off = !!I.off[r.i],
      bad = r.err || (r.dup && !r.fill),
      p = r.err ? null : pnl(o);
    const st = r.err
      ? `<span class="neg">${EM[r.err]}</span>`
      : r.fill
        ? `<span class="pos">${L("Already in your journal. The exit date will be added", "כבר ביומן. תאריך היציאה יתווסף")}</span>`
        : r.dup
          ? `<span class="mut">${L("Already in your journal", "כבר ביומן")}</span>`
          : r.W.length
            ? `<span class="iwt">${r.W.map(w => WM[w] + (w === "pl" ? ` (${L("sheet", "בגיליון")}: ${$f(o._pl, 2)})` : "")).join("<br>")}</span>`
            : `<span class="pos">${L("Ready", "מוכן")}</span>`;
    return `<tr class="${bad || off ? "ix" : r.W.length ? "iw" : ""}"><td><input type="checkbox" data-im="inc" data-i="${r.i}"${off || bad ? "" : " checked"}${bad ? " disabled" : ""} aria-label="${L("Import", "ייבוא")} ${esc(o.t)}"></td><td class="ist">${st}</td><td>${inp(r, "d", o.d, "dt dpk")}</td><td>${inp(r, "t", o.t)}</td><td><select data-im="ov" data-f="dir" data-i="${r.i}" aria-label="${L("Side", "כיוון")} ${esc(o.t)}"><option${o.dir === "Long" ? " selected" : ""}>Long</option><option${o.dir === "Short" ? " selected" : ""}>Short</option></select></td><td>${inp(r, "e", o.e)}</td><td>${inp(r, "s", o.s)}</td><td>${inp(r, "tg", o.tg)}</td><td>${inp(r, "sh", o.sh)}</td><td>${inp(r, "x", o.x)}</td><td>${o.x == null ? L("open", "פתוחה") : inp(r, "xd", o.xd, "dt dpk")}</td><td>${o.x == null ? "–" : esc(o.rs || "–")}</td><td class="${p > 0 ? "pos" : p < 0 ? "neg" : ""}">${p == null ? "–" : $f(p, 2)}</td><td>${o.m ?? "–"}</td></tr>`;
  })
  .join("")}</tbody></table></div>
${rows.length > 300 ? `<p class="mut sm">${L(`Showing 300 of ${rows.length} rows. All of them will be imported.`, `מוצגות 300 מתוך ${rows.length} שורות. כולן ייובאו.`)}</p>` : ""}
<p style="margin-top:12px">${I.T.length || I.F.length ? `<button data-a="imok">${I.T.length ? L(`Import ${I.T.length} trade${I.T.length === 1 ? "" : "s"}`, `ייבא ${I.T.length} עסקאות`) : ""}${I.T.length && I.F.length ? " + " : ""}${I.F.length ? L(`add ${I.F.length} exit date${I.F.length === 1 ? "" : "s"}`, `הוסף ${I.F.length} תאריכי יציאה`) : ""}</button> ` : ""}<button class="gh" data-a="imno">${L("Cancel", "ביטול")}</button></p>`;
}
