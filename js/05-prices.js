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
// Load live prices from Finnhub for open trades and the watchlist.
async function getPx() {
  if (!FK || S.keyBad) return;
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
    need = [...new Set([...lts, ...opn, ...S.wl.map(w => w.t)])].filter(Boolean);
  S.px = S.px || {};
  S.pxT = S.pxT || {};
  const todo = need.filter(
      t => !S.pxT[t] || Date.now() - S.pxT[t] > (lts.includes(t) ? Math.min(age, 18e5) : age)
    ),
    sd = smaDue();
  if (!todo.length && (!sd.length || smaBusy)) return;
  pxBusy = true;
  let ok = 0,
    bad = 0,
    rt = 0;
  for (let i = 0; i < todo.length; i++) {
    const t = todo[i];
    el.textContent = "Loading prices " + (i + 1) + "/" + todo.length + "...";
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
        S.pxT[t] = Date.now();
        continue;
      }
      const d = await r.json();
      S.pxT[t] = Date.now();
      if (d && d.c > 0) {
        S.px[t] = d.c;
        ok++;
        rt = 0;
      } else bad++;
    } catch (e) {
      bad++;
      S.pxT[t] = Date.now();
    }
    await pause(1100);
  }
  pxBusy = false;
  pxMsg = S.keyBad
    ? "The key was not accepted. Check it and save it again."
    : (ok || !todo.length
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
  el.textContent = pxMsg;
  smaRun();
  const a = document.activeElement;
  if (!a || !/INPUT|SELECT|TEXTAREA/.test(a.tagName)) view();
  if (pxAgain) getPx();
}
