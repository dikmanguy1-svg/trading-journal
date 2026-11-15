/*
 * 18j-day-trader.js — part of the TradeInk app script.
 *
 * Day trader tools (15.11), like the big trading journals (time of day, hold time, mistakes):
 * - Entry and exit time on every trade (t.tm / t.xt "HH:MM", in the trade's page, js/18i).
 * - Mistake tags on every trade (t.mk: FOMO, moved my stop...), for everyone, in the trade's page.
 * - "Stop after N losses in a row today" (S.set.dmc), checked with the other daily limits (js/18h).
 * - A "Day trading" card at the top of the Dashboard (day trader profile only):
 *   today, P&L by hour of entry, by weekday, hold time of winners vs losers, what mistakes cost.
 * Looks: css/13-ink-paper.css (".dd...").
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Mistake tags: id -> words on the button.
const DMK = {
  fomo: "FOMO",
  chase: "Chased the entry",
  stop: "Moved my stop",
  big: "Too big",
  rev: "Revenge trade",
  nos: "No setup",
  early: "Exited too early",
  plan: "Ignored my plan"
};
// "09:41" -> minutes since midnight, or null.
const ddMin = v => (/^\d{2}:\d{2}$/.test(v || "") ? +v.slice(0, 2) * 60 + +v.slice(3) : null);
// Minutes held (same-day trades with both times), or null.
const ddHold = t => {
  const a = ddMin(t.tm),
    b = ddMin(t.xt);
  if (a == null || b == null || t.x == null) return null;
  const days = t.xd && t.xd !== t.d ? (new Date(t.xd) - new Date(t.d)) / 864e5 : 0;
  const m = b - a + days * 1440;
  return m >= 0 ? m : null;
};
// "1h 05m" / "12m".
const ddDur = m =>
  m >= 60
    ? Math.floor(m / 60) + "h " + String(Math.round(m % 60)).padStart(2, "0") + "m"
    : Math.round(m) + "m";
// Losses in a row today (newest first; a win or breakeven stops the count).
function ddStreak() {
  const d = dkey(new Date()),
    c = S.trades
      .filter(t => t.x != null && t.xd === d)
      .sort((a, b) => ((a.xt || "") < (b.xt || "") ? 1 : -1));
  let n = 0;
  for (const t of c) {
    if (pnl(t) < 0) n++;
    else break;
  }
  return n;
}

// The trade page's extra fields (js/18i calls these).
const ddTimeField = (t, k, lab) =>
  `<label class="tpf"><span>${lab}</span><input type="time" data-tp="${k}" value="${esc(t[k] || "")}"></label>`;
const ddShowTimes = t => (typeof isDayTr === "function" && isDayTr()) || t.tm || t.xt;
const ddMistakes = t =>
  `<div class="tpw"><span>Mistakes in this trade</span><div class="ddmk">${Object.entries(DMK)
    .map(
      ([k, v]) =>
        `<button type="button" class="ddm${(t.mk || []).includes(k) ? " on" : ""}" data-tpm="${k}" aria-pressed="${(t.mk || []).includes(k)}">${v}</button>`
    )
    .join("")}</div></div>`;

// Simple bars: rows of [label, value]. Green for profit, red for loss.
function ddBars(rows) {
  const mx = Math.max(1, ...rows.map(r => Math.abs(r[1])));
  return `<div class="ddb">${rows
    .map(
      ([l, v, n]) =>
        `<div class="ddr"><span class="ddl" data-nt>${l}</span><span class="ddt"><i class="${v >= 0 ? "pos" : "neg"}" style="width:${((Math.abs(v) / mx) * 100).toFixed(1)}%"></i></span><b class="${v > 0 ? "pos" : v < 0 ? "neg" : "mut"}" data-nt>${$f(v, 0)}</b><small class="mut" data-nt>${n}</small></div>`
    )
    .join("")}</div>`;
}

// The Dashboard card (day traders only).
function dayDash() {
  if (typeof isDayTr !== "function" || !isDayTr()) return "";
  const s = dayStats(),
    st = ddStreak(),
    lim = dayLim(),
    cl = S.trades.filter(t => t.x != null);
  // By hour of entry.
  const H = {};
  cl.forEach(t => {
    const m = ddMin(t.tm);
    if (m == null) return;
    const h = Math.floor(m / 60);
    H[h] = H[h] || [0, 0];
    H[h][0] += pnl(t);
    H[h][1]++;
  });
  const hr = Object.keys(H)
    .map(Number)
    .sort((a, b) => a - b)
    .map(h => [String(h).padStart(2, "0") + ":00", H[h][0], H[h][1]]);
  // By weekday (of the entry date).
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    W = {};
  cl.forEach(t => {
    const w = new Date(t.d + "T12:00:00").getDay();
    W[w] = W[w] || [0, 0];
    W[w][0] += pnl(t);
    W[w][1]++;
  });
  const wd = [1, 2, 3, 4, 5, 0, 6].filter(w => W[w]).map(w => [tr(WD[w]), W[w][0], W[w][1]]);
  // Hold time: winners vs losers.
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null),
    hw = avg(
      cl
        .filter(t => pnl(t) > 0)
        .map(ddHold)
        .filter(m => m != null)
    ),
    hl = avg(
      cl
        .filter(t => pnl(t) < 0)
        .map(ddHold)
        .filter(m => m != null)
    );
  // What mistakes cost.
  const M = {};
  cl.forEach(t =>
    (t.mk || []).forEach(k => {
      M[k] = M[k] || [0, 0];
      M[k][0] += pnl(t);
      M[k][1]++;
    })
  );
  const mk = Object.keys(M)
    .sort((a, b) => M[a][0] - M[b][0])
    .map(k => [tr(DMK[k]), M[k][0], M[k][1]]);
  const none = m => `<p class="mut ddn">${m}</p>`;
  return `<div class="card dd"><p class="hk" aria-hidden="true">for day traders —</p><h2>Day trading</h2>
<div class="ddtoday"><span><small>Trades today</small><b class="ltn">${s.n}</b></span><span><small>P&amp;L today</small><b class="${s.pl > 0 ? "pos" : s.pl < 0 ? "neg" : ""}" data-nt>${$f(s.pl, 0)}</b></span><span><small>Losses in a row</small><b class="${st >= 2 ? "neg" : ""}" data-nt>${st}</b></span><span class="ddst ${lim ? "no" : "ok"}">${lim || (st >= 2 ? "Two losses in a row. Take a 15-minute break before the next trade." : "You are inside your daily limits.")}</span></div>
<div class="ddg"><div><h3>P&amp;L by hour of entry</h3>${hr.length ? ddBars(hr) : none("Write entry times in your trades' pages to see your best and worst hours.")}</div>
<div><h3>P&amp;L by weekday</h3>${wd.length ? ddBars(wd) : none("No closed trades yet.")}</div>
<div><h3>Time in the trade</h3>${hw == null && hl == null ? none("Write entry and exit times to see how long you hold winners and losers.") : `<p class="ddh"><span><small>Winners</small><b class="pos" data-nt>${hw == null ? "–" : ddDur(hw)}</b></span><span><small>Losers</small><b class="neg" data-nt>${hl == null ? "–" : ddDur(hl)}</b></span></p><p class="mut ddn">${hl != null && hw != null && hl > hw ? "You hold losers longer than winners. Cut them faster." : "Good: you do not hold losers longer than winners."}</p>`}</div>
<div><h3>What mistakes cost me</h3>${mk.length ? ddBars(mk) : none("Mark mistakes in a trade's page to see what they cost you.")}</div></div></div>`;
}

// Mistake buttons in the trade page.
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-tpm]");
  if (!b || !TP) return;
  const t = S.trades.find(x => x.id === TP.id);
  if (!t) return;
  const k = b.dataset.tpm,
    a = new Set(t.mk || []);
  a.has(k) ? a.delete(k) : a.add(k);
  t.mk = Object.keys(DMK).filter(x => a.has(x));
  save();
  view();
  setTimeout(() => {
    tpDraw();
    const n = document.querySelector(`#tpw [data-tpm="${k}"]`);
    if (n) n.focus();
  }, 0);
});
