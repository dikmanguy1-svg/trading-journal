/*
 * 13-mobile-cards.js — part of the TradeInk app script.
 *
 * Phone layout: cards instead of wide tables.
 * - wlCards(): the watchlist as cards. jCards(): the trade journal as cards.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

/* UX-B: trade cards for phones (the table stays for desktop). Remove jCards() call + this block to undo. */
// Which journal cards are open on phones.
const JMO = new Set();
document.addEventListener(
  "toggle",
  e => {
    const d = e.target;
    if (d.classList && d.classList.contains("jmore")) {
      if (d.open) JMO.add(d.dataset.id);
      else JMO.delete(d.dataset.id);
    }
  },
  true
);
// The watchlist as cards (phones).
function wlCards(sig) {
  if (!S.wl.length)
    return `<p class="mut card" style="text-align:center">Nothing on the watchlist yet. Add a stock above.</p>`;
  const ni = (k, v, lab, i, t) =>
    `<label>${lab}<input type="number" step="any" inputmode="decimal" data-k="${k}" data-i="${i}" value="${v ?? ""}" aria-label="${lab} ${esc(t)}"></label>`;
  return (
    `<div class="wlc">` +
    S.wl
      .map((w, i) => {
        const e = num(w.e),
          p = wp(w),
          d = e && p ? ((p - e) / e) * 100 : null;
        return `<article class="jc" aria-label="${esc(w.t)}"><div class="jch"><b>${esc(w.t)}</b><select class="wsd" data-k="wdir" data-i="${i}" aria-label="Side ${esc(w.t)}"><option${w.dir !== "Short" ? " selected" : ""}>Long</option><option${w.dir === "Short" ? " selected" : ""}>Short</option></select><span class="wsig">${sig(w)}</span></div>
 ${d != null ? `<div class="wpx mut"><span class="ltn">${(d > 0 ? "+" : "") + d.toFixed(1)}%</span> <span>to entry</span></div>` : ""}
 <div class="jg">${ni("we", w.e, "Entry", i, w.t)}${ni("ws", w.s, "Stop", i, w.t)}${ni("wt", w.tg, "Target", i, w.t)}${ni("wp", p, "Price", i, w.t)}</div>
 <div class="wact"><button class="gh sm" data-a="wc" data-i="${i}">Send to calculator</button><button class="gh sm" data-a="wd" data-i="${i}">Delete</button></div></article>`;
      })
      .join("") +
    `</div>`
  );
}
// The trade journal as cards (phones). Pressing a card's ticker or reason, or "Open",
// opens the trade's notebook page (js/18i-trade-page.js), where everything is written and changed.
function jCards(rows) {
  if (!rows.length)
    return `<div class="jcards"><p class="mut card" style="text-align:center">Nothing logged yet. Add your first trade in the form above.</p></div>`;
  return (
    `<div class="jcards">` +
    rows
      .map(t => {
        const p = pnl(t) ?? fl(t),
          o = t.x == null,
          now = o ? lp(t) : null;
        return `<article class="jc${o ? " jopen" : ""}" aria-label="${esc(t.t)}"><div class="jch"><span class="mut" data-nt>${esc(t.d)}</span><b data-n="${t.id}" role="button" tabindex="0" data-nt>${esc(t.t)}</b><span class="jdir">${t.dir}</span><span class="jpl ${p > 0 ? "pos" : p < 0 ? "neg" : ""}" data-nt>${$f(p, 2)}</span></div>
 <div class="rbox${t.th ? "" : " empty"}" data-n="${t.id}" role="button" tabindex="0">${t.th ? esc(t.th.slice(0, 90)) + (t.th.length > 90 ? "…" : "") : "Add reason"}</div>
 <div class="jkv"><div><span>Entry</span><b data-nt>${$f(t.e, 2)}</b></div><div><span>Shares</span><b data-nt>${t.sh}</b></div><div><span>${o ? "Now" : "Exit"}</span><b data-nt>${o ? (now == null ? "–" : $f(now, 2)) : $f(t.x, 2)}</b></div><div><span>R</span><b>${rCell(t)}</b></div></div>
 <div class="jact">${o ? `<button class="gh sm" data-a="cl" data-id="${t.id}">Close</button>` : ""}<button type="button" class="jopn" data-tpo="${t.id}"><span>Open the page</span> <span aria-hidden="true">›</span></button></div></article>`;
      })
      .join("") +
    `</div>`
  );
}
