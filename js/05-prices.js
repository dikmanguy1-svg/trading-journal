/*
 * 05-prices.js — part of the TradeInk app script.
 *
 * Live prices from Finnhub.
 * - FKS: the Finnhub key (temporary: it is public; a small server should hold it later).
 * - getPx(): loads current prices for open trades and the watchlist, about once a minute.
 * - SMA150 code (smaTD / smaRun / smaStep) is switched off (SMA_UI = false).
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Price loading state.
let pxBusy = false,
  // getPx() was asked to run while it was busy.
  pxAgain = false,
  pxMsg = "";
// Wait n milliseconds.
const pause = ms => new Promise(z => setTimeout(z, ms));
// Finnhub key (public; to be moved to a server).
const FKS = ["dbgask9r01qiroogojogdbgask9r01qiroogojp0"];
// The Finnhub key in use.
let FK = FKS[0],
  FKI = 0;
// SMA150 feature switch (off).
const SMA_UI = false;
// SMA150 is available.
const smaOn = () => SMA_UI && (!!(S.td && !S.tdBad) || !!(FK && !S.keyBad && !S.candBad));
// Tickers that need a fresh SMA150.
const smaDue = () =>
  smaOn() &&
  [...new Set(S.wl.map(w => w.t))].filter(
    t => t && (!(S.smaT || {})[t] || Date.now() - S.smaT[t] > 72e6)
  );
// SMA150 loading state.
let smaBusy = false;
// Load SMA150 values (feature off).
async function smaTD(todo) {
  let rt = 0;
  for (let i = 0; i < todo.length; i++) {
    const t = todo[i];
    $("pxs").textContent =
      "Loading SMA150 " +
      (i + 1) +
      "/" +
      todo.length +
      (todo.length > 8
        ? " (about " + Math.ceil(((todo.length - i) * 8.2) / 60) + " min left, free plan limit)"
        : "") +
      "...";
    try {
      const r = await fetch(
          "https://api.twelvedata.com/sma?symbol=" +
            encodeURIComponent(t) +
            "&interval=1day&time_period=150&outputsize=1&apikey=" +
            encodeURIComponent(S.td)
        ),
        d = await r.json();
      if (d && (d.code === 401 || d.code === 403)) {
        S.tdBad = true;
        break;
      }
      if (d && d.code === 429) {
        if (rt++ < 3) {
          await pause(30000);
          i--;
          continue;
        }
        break;
      }
      rt = 0;
      S.smaT[t] = Date.now();
      const v = d && Array.isArray(d.values) && d.values[0] ? parseFloat(d.values[0].sma) : NaN;
      if (isFinite(v) && v > 0) S.sma[t] = v;
    } catch (e) {}
    save();
    await pause(8200);
  }
}
// Run one SMA150 update at a time (feature off).
async function smaRun() {
  if (smaBusy) return;
  smaBusy = true;
  try {
    await smaStep();
  } finally {
    smaBusy = false;
    pxMsg =
      pxMsg.replace(/ · (For automatic|The Twelve).*$/, "") +
      (S.tdBad
        ? " · The Twelve Data key was not accepted"
        : S.candBad && !S.td
          ? " · For automatic SMA150 add a free Twelve Data key in Settings"
          : "");
    $("pxs").textContent = pxMsg;
    const a = document.activeElement;
    if (!a || !/INPUT|SELECT|TEXTAREA/.test(a.tagName)) view();
  }
}
// One SMA150 update (feature off).
async function smaStep() {
  const todo = smaDue();
  if (!todo.length) return;
  S.sma = S.sma || {};
  S.smaT = S.smaT || {};
  if (S.td && !S.tdBad) return smaTD(todo);
  if (!FK || S.keyBad) return;
  const to = Math.floor(Date.now() / 1e3),
    from = to - 86400 * 330;
  for (let i = 0; i < todo.length; i++) {
    const t = todo[i];
    $("pxs").textContent = "Loading SMA150 " + (i + 1) + "/" + todo.length + "...";
    try {
      const r = await fetch(
        "https://finnhub.io/api/v1/stock/candle?symbol=" +
          encodeURIComponent(t) +
          "&resolution=D&from=" +
          from +
          "&to=" +
          to +
          "&token=" +
          encodeURIComponent(FK)
      );
      if (r.status === 401 || r.status === 403) {
        S.candBad = true;
        break;
      }
      if (r.status === 429) {
        await pause(15000);
        i--;
        continue;
      }
      const d = await r.json();
      S.smaT[t] = Date.now();
      if (d && d.s === "ok" && Array.isArray(d.c) && d.c.length >= 150) {
        const c = d.c.slice(-150);
        S.sma[t] = c.reduce((a, b) => a + b, 0) / 150;
      }
    } catch (e) {}
    await pause(1100);
  }
}
// Redraw with the prices loaded so far. While the user is typing in a field (any tab,
// e.g. Strategy), only the P&L box at the top is redrawn, so the field is not lost.
// pxLate: new prices arrived while the user was in a field; redraw as soon as they leave it (13.11).
let pxLate = false;
const pxInField = () => {
  const a = document.activeElement;
  return !!(a && /INPUT|SELECT|TEXTAREA/.test(a.tagName));
};
function pxShow() {
  try {
    hs();
    if (!pxInField()) {
      pxLate = false;
      view();
    } else pxLate = true;
  } catch (e) {
    // A drawing error must not stop the price loading (it would stay "busy" for good).
  }
}
// The user left a field: if new prices are waiting, show them now (no need to switch tabs).
document.addEventListener("focusout", () => {
  if (!pxLate) return;
  setTimeout(() => {
    if (pxLate && !pxInField()) pxShow();
  }, 0);
});
// Load live prices from Finnhub for long-term holdings, open trades and the watchlist.
// Last known prices, kept on this device (13.11), so totals are right the moment the site opens
// instead of showing buy prices until the new prices arrive. Only tickers and prices, nothing else.
const pxSeen = new WeakSet();
function pxCacheLoad() {
  if (!S.px || typeof S.px !== "object") S.px = {};
  if (!S.pxT || typeof S.pxT !== "object") S.pxT = {};
  if (pxSeen.has(S.px)) return;
  pxSeen.add(S.px);
  try {
    const c = JSON.parse(localStorage.getItem("tj_px") || "{}");
    for (const t in c.p || {})
      if (S.px[t] == null && +c.p[t] > 0) {
        S.px[t] = +c.p[t];
        if (!S.pxT[t]) S.pxT[t] = +(c.t || {})[t] || 0;
      }
  } catch (e) {}
}
// Last known prices of the user's own tickers (open trades, long-term, watchlist), saved with the journal.
function pxLast() {
  const o = {},
    want = new Set([
      ...S.trades.filter(t => t.x == null).map(t => t.t),
      ...ltSyms(),
      ...S.wl.map(w => w.t)
    ]);
  for (const t of want) if (t && S.px && +S.px[t] > 0) o[t] = +S.px[t];
  return o;
}
// After login: use the prices saved with the journal for tickers this device has no price for yet.
// They are not marked fresh, so the live prices load right after.
function pxFromCloud(o) {
  if (!o || typeof o !== "object") return;
  S.px = S.px || {};
  for (const t in o)
    if (/^[A-Z0-9.\-]{1,10}$/.test(t) && +o[t] > 0 && S.px[t] == null) S.px[t] = +o[t];
}
function pxCacheSave() {
  try {
    localStorage.setItem("tj_px", JSON.stringify({ p: S.px || {}, t: S.pxT || {} }));
  } catch (e) {}
}
async function getPx() {
  if (!FK || S.keyBad) return;
  pxCacheLoad();
  // Already loading: run once more right after, so new holdings (e.g. after login) are not missed.
  if (pxBusy) return void (pxAgain = true);
  pxAgain = false;
  const el = $("pxs"),
    open = mktOpen(),
    age = open ? 18e4 : 216e5;
  // Long-term holdings first: they change the total P&L. They are refreshed every 30 minutes
  // (like the long-term panel), so the total is right without opening the panel.
  const opn = S.trades.filter(t => t.x == null).map(t => t.t),
    lts = ltSyms(),
    // On the Trade journal tab, open trades load first; elsewhere long-term holdings first (13.11).
    jr = tab === "jr",
    fst = new Set(jr ? opn : lts),
    need = [
      ...new Set([...(jr ? [...opn, ...lts] : [...lts, ...opn]), ...S.wl.map(w => w.t)])
    ].filter(Boolean);
  S.px = S.px || {};
  S.pxT = S.pxT || {};
  const todo = need.filter(
      t => !S.pxT[t] || Date.now() - S.pxT[t] > (lts.includes(t) ? Math.min(age, 18e5) : age)
    ),
    sd = smaDue();
  if (!todo.length && (!sd.length || smaBusy)) return;
  pxBusy = true;
  hs();
  try {
    // Our server first (13.11); if it cannot be used, the old way (straight from Finnhub).
    if (!(await pxServer(todo, open, el, fst)))
      await pxLoop(todo, new Set([...lts, ...opn]), open, el, fst);
  } finally {
    // Never stay "busy" after an error, or prices would stop updating until a reload.
    pxBusy = false;
  }
  pxCacheSave();
  smaRun();
  pxShow();
  if (pxAgain) getPx();
}
// A price that could not be loaded is tried again in 2 minutes (not hours later).
const pxRetry = (t, age) => (S.pxT[t] = Date.now() - age + 12e4);
// Load the prices one by one (Finnhub allows about one a second).
// Prices from our server (13.11): one shared cache for all users, and the Finnhub key stays secret.
// Asks for up to 40 tickers at once. Returns false when the server cannot be used (then the old way runs).
// tks: tickers to ask for (the first group first). Returns { got, miss, busy } for js/12.
async function pxAsk(tks) {
  if (!U || typeof CO_URL !== "string" || !CO_URL || !tks.length) return null;
  const got = new Set(),
    miss = new Set();
  let busy = false;
  try {
    const tok = await U.getIdToken();
    for (let i = 0; i < tks.length; i += 40) {
      const part = tks.slice(i, i + 40),
        ctl = new AbortController(),
        tm = setTimeout(() => ctl.abort(), 20000);
      let r, d;
      try {
        r = await fetch(CO_URL + "/px?s=" + encodeURIComponent(part.join(",")), {
          headers: { Authorization: "Bearer " + tok },
          signal: ctl.signal
        });
        d = r.ok ? await r.json() : null;
      } finally {
        clearTimeout(tm);
      }
      // The server is not ready (for example an older version): use the old way.
      if (!d || typeof d.p !== "object") {
        if (!i) return null;
        part.forEach(t => miss.add(t));
        continue;
      }
      S.px = S.px || {};
      S.pxT = S.pxT || {};
      for (const t of part) {
        const v = +d.p[t],
          o = d.old ? +d.old[t] : 0;
        if (v > 0) {
          S.px[t] = v;
          S.pxT[t] = Date.now();
          got.add(t);
        } else {
          // An older price from the server is better than none, but it is asked again soon.
          if (o > 0 && S.px[t] == null) S.px[t] = o;
          miss.add(t);
        }
      }
      if (d.busy) busy = true;
    }
  } catch (e) {
    if (!got.size && !miss.size) return null;
  }
  return { got, miss, busy };
}
// Load prices through our server for getPx(). Returns false when the server cannot be used.
async function pxServer(todo, open, el, fst) {
  const age = open ? 18e4 : 216e5,
    a = todo.filter(t => fst && fst.has(t)),
    b = todo.filter(t => !(fst && fst.has(t)));
  let ok = 0,
    bad = 0,
    any = false;
  // The first group (what the user is looking at) gets its own request, so it shows first.
  for (const part of [a, b]) {
    if (!part.length) continue;
    if (el) el.textContent = "Loading prices...";
    const r = await pxAsk(part);
    if (!r) {
      if (!any) return false;
      part.forEach(t => (bad++, pxRetry(t, age)));
      continue;
    }
    any = true;
    ok += r.got.size;
    r.miss.forEach(t => (bad++, pxRetry(t, age)));
    pxShow();
  }
  pxDone(ok, bad, open, todo.length, el);
  return true;
}
// fst: the group shown first (open trades on the Trade journal tab, otherwise long-term holdings).
async function pxLoop(todo, key, open, el, fst) {
  const age = open ? 18e4 : 216e5;
  let ok = 0,
    bad = 0,
    rt = 0;
  for (let i = 0; i < todo.length; i++) {
    const t = todo[i];
    if (el) el.textContent = "Loading prices " + (i + 1) + "/" + todo.length + "...";
    try {
      const r = await fetch(
        "https://finnhub.io/api/v1/quote?symbol=" +
          encodeURIComponent(t) +
          "&token=" +
          encodeURIComponent(FK)
      );
      if (r.status === 401 || r.status === 403) {
        if (FKI < FKS.length - 1) {
          FK = FKS[++FKI];
          i--;
          continue;
        }
        S.keyBad = true;
        break;
      }
      if (r.status === 429) {
        if (rt++ < 3) {
          await pause(15000);
          i--;
          continue;
        }
        bad++;
        pxRetry(t, age);
        continue;
      }
      const d = await r.json();
      if (d && d.c > 0) {
        S.px[t] = d.c;
        S.pxT[t] = Date.now();
        ok++;
        rt = 0;
      } else {
        bad++;
        pxRetry(t, age);
      }
    } catch (e) {
      bad++;
      pxRetry(t, age);
    }
    // Long-term holdings and open trades load first. Once they are in, show the new totals
    // right away, without waiting for the watchlist prices.
    // The first group is shown as soon as it is in, too.
    if ((key.has(t) && !key.has(todo[i + 1])) || (fst && fst.has(t) && !fst.has(todo[i + 1])))
      pxShow();
    await pause(1100);
  }
  pxDone(ok, bad, open, todo.length, el);
}
// The price status line ("Prices updated 15:42 · US market open").
function pxDone(ok, bad, open, n, el) {
  pxMsg = S.keyBad
    ? "The key was not accepted. Check it and save it again."
    : (ok || !n
        ? "Prices updated " +
          new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
          " · US market " +
          (open ? "open" : "closed") +
          (bad ? " (" + bad + " not found)" : "")
        : "Could not load prices") +
      (S.tdBad
        ? " · The Twelve Data key was not accepted"
        : S.candBad && !S.td
          ? " · For automatic SMA150 add a free Twelve Data key in Settings"
          : "");
  if (el) el.textContent = pxMsg;
}
