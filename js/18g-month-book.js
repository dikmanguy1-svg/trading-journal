/*
 * 18g-month-book.js — part of the TradeInk app script.
 *
 * Monthly report as a calendar (14.11, design E): 12 month squares for a year.
 * Pressing a month opens its notebook page:
 * - trades closed that month (exit date in the month) with R and P&L,
 * - trades still open, and how they moved since the start of the month:
 *   S.mps[YYYY-MM] = { d, p, e }: p = prices at the start of the month, e = the last prices seen
 *   in that month (kept up to date while the app is open). A month starts from the previous
 *   month's last prices, or from the first prices seen by the 3rd of the month.
 *   Trades opened this month, or with no start price, count from their entry price (row says so),
 * - "What I learned" for that month (S.mbl[YYYY-MM], your own words, saved with the journal).
 * js/06 puts monHTML() at the top of the Monthly report tab. Looks: css/13-ink-paper.css.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// The year shown and the month that is open ("YYYY-MM").
const MB = { y: new Date().getFullYear(), m: new Date().toISOString().slice(0, 7) };
const MBN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "+$1,240" / "−$410".
const mbMoney = v => (v >= 0 ? "+" : "−") + $f(Math.abs(v), 0);
// Closed trades whose exit date is in month ym.
const mbClosed = ym => S.trades.filter(t => t.x != null && (t.xd || t.d).slice(0, 7) === ym);
// The month that is happening now.
const mbNow = () => new Date().toISOString().slice(0, 7);

// The month before ym ("2026-11" -> "2026-10").
const mbPrev = ym => {
  const y = +ym.slice(0, 4),
    m = +ym.slice(5);
  return m === 1 ? y - 1 + "-12" : y + "-" + String(m - 1).padStart(2, "0");
};
// Keep the month's prices up to date (runs every minute and when the page is drawn).
// e: last prices seen this month. p: start-of-month prices (from last month's e, or by the 3rd).
let mbDay = "";
function mbTrack() {
  if (!S || !S.trades || !S.px) return;
  const ym = mbNow(),
    today = new Date().toISOString().slice(0, 10),
    open = S.trades.filter(t => t.x == null && S.px[t.t] > 0);
  if (!open.length) return;
  S.mps = S.mps || {};
  const o = (S.mps[ym] = S.mps[ym] || { d: "", p: {} }),
    pe = (S.mps[mbPrev(ym)] || {}).e || {};
  // Prices kept before 15.11 were taken mid-month (when the page was first opened): start again.
  if (!o.e && o.d && +o.d.slice(8) > 3) ((o.p = {}), (o.d = ""));
  o.e = o.e || {};
  let ch = false;
  open.forEach(t => {
    const v = S.px[t.t];
    if (o.e[t.t] !== v) ((o.e[t.t] = v), (ch = true));
    if (o.p[t.t]) return;
    // Start price: last month's last price, or today's if it is still the start of the month.
    const st = pe[t.t] || (+today.slice(8) <= 3 ? v : 0);
    if (st) {
      o.p[t.t] = st;
      if (!o.d) o.d = today;
      ch = true;
    }
  });
  // Saved once a day (the journal saves often anyway); the last price is kept in memory.
  if (ch && mbDay !== today) {
    mbDay = today;
    save();
  }
}
setInterval(mbTrack, 6e4);

function monHTML() {
  const ym = MB.m,
    y = MB.y;
  mbTrack();
  const sq = MBN.map((n, i) => {
    const k = y + "-" + String(i + 1).padStart(2, "0"),
      c = mbClosed(k),
      p = c.reduce((s, t) => s + pnl(t), 0),
      fut = k > mbNow();
    return `<button type="button" class="mbm${k === ym ? " on" : ""}" data-mb="${k}"${fut ? " disabled" : ""} aria-pressed="${k === ym}"><b>${n}</b><span class="${c.length ? (p >= 0 ? "pos" : "neg") : "mut"}" data-nt>${c.length ? mbMoney(p) : fut ? "" : "–"}</span><small>${c.length ? `<span class="ltn">${c.length}</span> <span>trades</span>` : ""}</small></button>`;
  }).join("");
  const cl = mbClosed(ym),
    tp = cl.reduce((s, t) => s + pnl(t), 0),
    end = ym + "-31",
    snap = (S.mps || {})[ym] || {},
    // Past months: what was open at the end of that month. This month: what is open now.
    op = S.trades.filter(t => t.d <= end && (t.x == null || (ym < mbNow() && (t.xd || t.d) > end))),
    nm = MBN[+ym.slice(5) - 1] + " " + ym.slice(0, 4);
  const cRows = cl.length
    ? cl
        .map(t => {
          const r = aR(t),
            p = pnl(t);
          return `<tr><td><b data-nt>${esc(t.t)}</b></td><td class="mut" data-nt>${esc(t.d.slice(5))} → ${esc((t.xd || "").slice(5))}</td><td class="${r == null ? "mut" : r >= 0 ? "pos" : "neg"}" data-nt>${r == null ? "–" : r.toFixed(1) + "R"}</td><td class="${p >= 0 ? "pos" : "neg"}" data-nt>${mbMoney(p)}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="mut">No trades closed this month.</td></tr>`;
  const oRows = op.length
    ? op
        .map(t => {
          // Past months: up to the last price seen in that month. This month: the live price.
          const now = ym === mbNow() ? S.px && S.px[t.t] : (snap.e || {})[t.t],
            mine = t.d.slice(0, 7) === ym,
            st = !mine && snap.p && snap.p[t.t],
            from = st || t.e,
            sg = t.dir === "Short" ? -1 : 1,
            ch = now ? ((now - from) / from) * 100 * sg : null,
            d = now ? (now - from) * t.sh * sg : null;
          return `<tr><td><b data-nt>${esc(t.t)}</b><small class="mbf">${mine ? "Opened this month" : st ? "From the 1st" : "Since entry"}</small></td><td data-nt>${$f(from, 2)} → ${now ? $f(now, 2) : ym === mbNow() ? "…" : "–"}</td><td class="${ch == null ? "mut" : ch >= 0 ? "pos" : "neg"}" data-nt>${ch == null ? "–" : (ch >= 0 ? "+" : "") + ch.toFixed(1) + "%"}</td><td class="${d == null ? "mut" : d >= 0 ? "pos" : "neg"}" data-nt>${d == null ? "–" : mbMoney(d)}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="mut">No open trades.</td></tr>`;
  return `<div class="mbk"><div class="card mbg"><div class="mby"><button type="button" class="gh sm" data-mby="-1" aria-label="Previous year">‹</button><b data-nt>${y}</b><button type="button" class="gh sm" data-mby="1" aria-label="Next year">›</button></div><div class="mbs">${sq}</div></div>
<div class="card mbd"><div class="mbh"><h2 data-nt>${nm}</h2><span><span>P&amp;L</span> <b class="${tp >= 0 ? "pos" : "neg"}" data-nt>${cl.length ? mbMoney(tp) : "–"}</b></span><span><span>Closed</span> <b class="ltn">${cl.length}</b></span><span><span>Still open</span> <b class="ltn">${op.length}</b></span></div>
<div class="mbc"><div><h3>Closed this month</h3><table class="mbt"><tbody>${cRows}</tbody></table></div><div><h3>${ym === mbNow() ? "Still open" : "Open at the end of the month"}</h3><table class="mbt"><tbody>${oRows}</tbody></table></div></div>
<label class="mbl"><span>What I learned in <span data-nt>${nm}</span></span><textarea data-mbl="${ym}" rows="3" maxlength="2000" placeholder="Write it in your own words…">${esc((S.mbl || {})[ym] || "")}</textarea></label></div></div>`;
}

// Pick a month, change the year, write what you learned.
document.addEventListener("click", e => {
  const m = e.target.closest && e.target.closest("[data-mb]");
  if (m) {
    MB.m = m.dataset.mb;
    view();
    const b = document.querySelector(`[data-mb="${MB.m}"]`);
    if (b) b.focus();
    return;
  }
  const yb = e.target.closest && e.target.closest("[data-mby]");
  if (yb) {
    MB.y += +yb.dataset.mby;
    MB.m = MB.y + "-" + (MB.y === new Date().getFullYear() ? mbNow().slice(5) : "12");
    view();
  }
});
document.addEventListener("change", e => {
  const t = e.target.closest && e.target.closest("[data-mbl]");
  if (!t) return;
  S.mbl = S.mbl || {};
  const v = t.value.trim().slice(0, 2000);
  if (v) S.mbl[t.dataset.mbl] = v;
  else delete S.mbl[t.dataset.mbl];
  save();
});
