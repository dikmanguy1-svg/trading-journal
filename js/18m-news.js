/*
 * 18m-news.js — part of the TradeInk app script.
 *
 * News and earnings for YOUR stocks (17.11): open trades, the watchlist and the long-term portfolio.
 * - "My week" card at the top of the Dashboard: who reports in the next 14 days + a few headlines.
 * - A "News & earnings" tab (under "More" for most profiles): earnings for 30 days,
 *   headlines per stock (last 3 days), and the day's market headlines.
 * - A small "reports in 2 days" tag next to the ticker in the journal and the watchlist.
 * Data: our server (CO_URL, js/14) asks Finnhub and keeps the answers for a few hours:
 *   GET /earn?s=AAPL,MSFT  -> { e: [{ s, d: "2026-11-20", h: "bmo"|"amc"|"", eps, q }] }
 *   GET /news?s=AAPL,MSFT  -> { n: [{ s, t: headline, u: link, src, ts: unix seconds }] }
 *   GET /news?s=_mkt       -> market headlines, same shape.
 * Only headlines and links are shown (the articles belong to their sites).
 * Until the server has these, nothing shows (NWDEMO = true shows sample data, for the demo).
 * Kept on this device for 3 hours (tj_nw). Looks: css/13-ink-paper.css (".nw...").
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

let NWDEMO = false;
// { t: time loaded, k: tickers key, e: earnings, n: news, m: market news, off: server has no data }
let NW = null;
try {
  NW = JSON.parse(localStorage.getItem("tj_nw") || "null");
} catch (e) {
  NW = null;
}
let nwBusy = false;

// The tab.
T.push(["news", "News & earnings"]);
TABH.news = [
  "What's coming",
  "for your stocks.",
  "Earnings dates and the latest headlines for your open trades, watchlist and portfolio.",
  "jr",
  "Open my journal"
];
HK.news = "before it moves your stock —";

// Your stocks and where they come from: { AAPL: ["Open trade", "Watchlist"] }.
function nwMine() {
  const m = {},
    add = (t, w) => {
      t = String(t || "")
        .trim()
        .toUpperCase();
      if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t)) return;
      (m[t] = m[t] || []).includes(w) || m[t].push(w);
    };
  S.trades.filter(t => t.x == null).forEach(t => add(t.t, "Open trade"));
  (S.wl || []).forEach(w => add(w.t, "Watchlist"));
  if (typeof ltD === "function") ltD().h.forEach(h => add(h.t, "Portfolio"));
  return m;
}
const nwKey = () => Object.keys(nwMine()).sort().join(",");

// Sample data for the demo (NWDEMO).
function nwDemo() {
  const d = n => dkey(new Date(Date.now() + n * 864e5)),
    s = Object.keys(nwMine()),
    a = s[0] || "AAPL",
    b = s[1] || "NVDA",
    c = s[2] || "MSFT",
    now = Date.now() / 1e3;
  return {
    t: Date.now(),
    k: nwKey(),
    e: [
      { s: a, d: d(2), h: "amc", eps: 1.42, q: "Q4 2026" },
      { s: b, d: d(6), h: "bmo", eps: 0.81, q: "Q3 2027" },
      { s: c, d: d(19), h: "amc", eps: 3.1, q: "Q2 2027" }
    ],
    n: [
      {
        s: a,
        t: a + " raises its yearly sales forecast after strong demand",
        u: "https://example.com/1",
        src: "Reuters",
        ts: now - 3600 * 2
      },
      {
        s: b,
        t: "Analysts lift price targets on " + b + " ahead of earnings",
        u: "https://example.com/2",
        src: "MarketWatch",
        ts: now - 3600 * 7
      },
      {
        s: a,
        t: "What to watch in " + a + "'s report this week",
        u: "https://example.com/3",
        src: "Yahoo Finance",
        ts: now - 3600 * 20
      },
      {
        s: c,
        t: c + " announces a new $10 billion buyback",
        u: "https://example.com/4",
        src: "CNBC",
        ts: now - 3600 * 30
      }
    ],
    m: [
      {
        s: "",
        t: "Stocks open higher as investors wait for inflation data",
        u: "https://example.com/5",
        src: "Reuters",
        ts: now - 1800
      },
      {
        s: "",
        t: "Fed officials signal patience on the next rate move",
        u: "https://example.com/6",
        src: "Bloomberg",
        ts: now - 3600 * 5
      },
      {
        s: "",
        t: "Oil slips as supply worries ease",
        u: "https://example.com/7",
        src: "CNBC",
        ts: now - 3600 * 9
      }
    ]
  };
}

// Load from our server (every 3 hours, or when your stocks change).
async function nwLoad(force) {
  if (NWDEMO) {
    if (!NW || NW.k !== nwKey() || !NW.demo) NW = { ...nwDemo(), demo: true };
    return;
  }
  const k = nwKey();
  if (nwBusy || !U || typeof CO_URL !== "string" || !CO_URL) return;
  if (!force && NW && NW.k === k && Date.now() - NW.t < 3 * 36e5) return;
  nwBusy = true;
  try {
    const tok = await U.getIdToken(),
      get = async p => {
        const r = await fetch(CO_URL + p, { headers: { Authorization: "Bearer " + tok } });
        if (r.status === 404) throw new Error("off");
        return r.ok ? r.json() : null;
      },
      s = encodeURIComponent(k.split(",").slice(0, 40).join(","));
    const [e, n, m] = await Promise.all([
      k ? get("/earn?s=" + s) : { e: [] },
      k ? get("/news?s=" + s) : { n: [] },
      get("/news?s=_mkt")
    ]);
    NW = { t: Date.now(), k, e: (e && e.e) || [], n: (n && n.n) || [], m: (m && m.n) || [] };
  } catch (x) {
    // The server does not have news yet: stay quiet, try again in 3 hours.
    NW = { t: Date.now(), k, e: [], n: [], m: [], off: x.message === "off" };
  } finally {
    nwBusy = false;
  }
  try {
    localStorage.setItem("tj_nw", JSON.stringify(NW));
  } catch (e) {}
  if (tab === "dash" || tab === "news" || tab === "jr" || tab === "wl") view();
}

// Days until a date ("2026-11-20"): 0 = today.
const nwDays = d =>
  Math.round((new Date(d + "T12:00:00") - new Date(dkey(new Date()) + "T12:00:00")) / 864e5);
// "Thu 20.11".
const nwDay = d => {
  const x = new Date(d + "T12:00:00");
  return (
    tr(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x.getDay()]) +
    " " +
    d.slice(8) +
    "." +
    d.slice(5, 7)
  );
};
const nwWhen = h =>
  h === "bmo" ? "Before the open" : h === "amc" ? "After the close" : "Time not set";
// "2h ago" / "3d ago".
const nwAgo = ts => {
  const m = Math.max(1, Math.round((Date.now() / 1e3 - ts) / 60)),
    [n, k] =
      m < 60
        ? [m, "{n}m ago"]
        : m < 1440
          ? [Math.round(m / 60), "{n}h ago"]
          : [Math.round(m / 1440), "{n}d ago"];
  return tr(k).replace("{n}", n);
};
// Earnings of your stocks in the next n days, nearest first.
const nwEarn = n =>
  ((NW && NW.e) || [])
    .filter(x => x && x.d && nwDays(x.d) >= 0 && nwDays(x.d) <= n && nwMine()[x.s])
    .sort((a, b) => (a.d < b.d ? -1 : 1));

// The tag next to a ticker: reports within 3 days.
function nwTag(t) {
  const x = ((NW && NW.e) || []).find(e => e.s === t && nwDays(e.d) >= 0 && nwDays(e.d) <= 3);
  if (!x) return "";
  const n = nwDays(x.d);
  return ` <span class="nwtag" title="${esc(tr("Earnings") + " " + nwDay(x.d) + " · " + tr(nwWhen(x.h)))}" data-nt>${esc(n === 0 ? tr("Reports today") : n === 1 ? tr("Reports tomorrow") : tr("Reports in") + " " + n + " " + tr("days"))}</span>`;
}

const nwErow = x =>
  `<li class="nwe"><span class="nwd"><b data-nt>${esc(nwDay(x.d))}</b><small>${nwWhen(x.h)}</small></span><span class="nws"><b data-nt>${esc(x.s)}</b><small data-nt>${(nwMine()[x.s] || []).map(w => `<span class="nwfrom">${esc(tr(w))}</span>`).join(" ")}</small></span><span class="nweps"><small>EPS estimate</small><b data-nt>${x.eps == null ? "–" : "$" + (+x.eps).toFixed(2)}</b></span></li>`;
const nwNrow = x =>
  `<li class="nwn"><a href="${esc(/^https:\/\//.test(x.u) ? x.u : "#")}" target="_blank" rel="noopener noreferrer"><span class="nwh" data-nt>${esc(x.t)}</span><small data-nt>${x.s ? `<b>${esc(x.s)}</b> · ` : ""}${esc(x.src || "")} · ${esc(nwAgo(x.ts))}</small></a></li>`;

// The Dashboard card.
function nwCard() {
  nwLoad();
  if (!NW || NW.off || (!NW.e.length && !NW.n.length && !NW.m.length)) return "";
  const e = nwEarn(14),
    n = NW.n
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 4);
  return `<div class="card nwc"><p class="hk" aria-hidden="true">your week ahead —</p><div class="nwtop"><h2>My week</h2><button type="button" class="gh sm" data-t="news">All news and earnings ›</button></div>
<div class="nwg"><div><h3>Reporting soon</h3>${e.length ? `<ul class="nwl">${e.map(nwErow).join("")}</ul>` : `<p class="mut">None of your stocks reports in the next 14 days.</p>`}</div>
<div><h3>Your stocks in the news</h3>${n.length ? `<ul class="nwl">${n.map(nwNrow).join("")}</ul>` : `<p class="mut">No news about your stocks in the last 3 days.</p>`}</div></div></div>`;
}

// The tab.
function nwPage() {
  nwLoad();
  const mine = nwMine();
  if (!Object.keys(mine).length && (!NW || !NW.m.length))
    return `<div class="card"><h2>News & earnings</h2><p class="mut">Add stocks to your journal, watchlist or portfolio, and their earnings and news show up here.</p></div>`;
  if (!NW || NW.off)
    return `<div class="card"><h2>News & earnings</h2><p class="mut">${NW && NW.off ? "News and earnings are coming soon." : "Loading…"}</p></div>`;
  const e = nwEarn(30),
    by = {};
  NW.n.forEach(x => (by[x.s] = by[x.s] || []).push(x));
  const sec = Object.keys(by)
    .sort()
    .map(
      s =>
        `<div class="nwst"><h3 data-nt>${esc(s)} <small>${(mine[s] || []).map(w => `<span class="nwfrom">${esc(tr(w))}</span>`).join(" ")}</small></h3><ul class="nwl">${by[
          s
        ]
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 5)
          .map(nwNrow)
          .join("")}</ul></div>`
    )
    .join("");
  return `<div class="card nwc"><h2>Reporting in the next 30 days</h2>${e.length ? `<ul class="nwl">${e.map(nwErow).join("")}</ul>` : `<p class="mut">None of your stocks reports in the next 30 days.</p>`}<p class="mut sm">Holding a trade through earnings can move the price a lot, both ways. Decide before, not on the day.</p></div>
<div class="card nwc"><h2>Your stocks in the news</h2>${sec || `<p class="mut">No news about your stocks in the last 3 days.</p>`}</div>
${NW.m.length ? `<div class="card nwc"><h2>Market headlines</h2><ul class="nwl">${NW.m.slice(0, 8).map(nwNrow).join("")}</ul></div>` : ""}
<p class="mut sm nwsrc">Headlines and earnings dates from Finnhub. Links open the original article.</p>`;
}
