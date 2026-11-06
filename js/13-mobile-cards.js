/*
 * 13-mobile-cards.js — part of the Trading.Journal app script.
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
// The trade journal as cards (phones).
function jCards(rows) {
  const ni = (k, v, lab, t) =>
    `<label>${lab}<input type="number" step="any" inputmode="decimal" class="ti" data-k="${k}" data-id="${t.id}" value="${v ?? ""}" aria-label="${lab} ${esc(t.t)}"></label>`;
  if (!rows.length)
    return `<div class="jcards"><p class="mut card" style="text-align:center">Nothing logged yet. Add your first trade in the form above.</p></div>`;
  return (
    `<div class="jcards">` +
    rows
      .map(t => {
        const p = pnl(t) ?? fl(t),
          R = aR(t),
          o = t.x == null;
        return `<article class="jc" aria-label="${esc(t.t)}"><div class="jch"><input type="text" readonly class="ti dt dpk" data-k="tdt" data-id="${t.id}" value="${esc(t.d)}" aria-label="Entry date ${esc(t.t)}"><b data-n="${t.id}" role="button" tabindex="0">${esc(t.t)}</b><span class="jdir">${t.dir}</span><span class="jpl ${p > 0 ? "pos" : p < 0 ? "neg" : ""}">${$f(p, 2)}</span></div>
 <div class="rbox${t.th ? "" : " empty"}" data-n="${t.id}" role="button" tabindex="0">${t.th ? esc(t.th.slice(0, 90)) + (t.th.length > 90 ? "…" : "") : "Add reason"}</div>
 <div class="jg">${ni("te", t.e, "Entry", t)}${ni("ts", t.s, "Stop", t)}${ni("tg", t.tg, "Target", t)}${ni("tsh", t.sh, "Shares", t)}</div>
 <div class="jg jg2"><label>Exit${o ? `<span class="jro">open</span>` : `<input type="number" step="any" inputmode="decimal" class="ti" data-k="tx" data-id="${t.id}" value="${t.x}" aria-label="Exit price ${esc(t.t)}">`}</label><label>Exit date${o ? `<span class="jro">–</span>` : `<input type="text" readonly class="ti dt dpk" data-k="txd" data-id="${t.id}" value="${esc(t.xd || "")}" placeholder="Set date" aria-label="Exit date ${esc(t.t)}">`}</label></div>
 <details class="jmore" data-id="${t.id}"${JMO.has(t.id) ? " open" : ""}><summary>More</summary><div class="jkv"><div><span>Size</span><b>${$f(cost(t), 0)} <small class="mut">${((cost(t) / acct()) * 100).toFixed(1)}%</small></b></div><div><span>Risk $</span><b>${$f(risk(t), 0)}</b></div><div><span>Plan R:R</span><b>${rr(t) == null ? "–" : rr(t).toFixed(1)}</b></div><div><span>Current price</span><b>${o ? (lp(t) == null ? "–" : $f(lp(t), 2)) : "–"}</b></div><div><span>R</span><b>${R == null ? "–" : R.toFixed(2) + "R"}</b></div><div><span>Mind</span><b>${t.m ?? "–"}</b></div></div><div class="jfull"><span class="mut">Followed my rules?</span>${rkUI(t)}</div>${o ? "" : `<label class="jfull">Exit type<select data-k="trs" data-id="${t.id}" aria-label="Exit type ${esc(t.t)}"><option value="">Choose</option>${RSL.map(x => `<option${t.rs === x ? " selected" : ""}>${x}</option>`).join("")}</select></label><div class="jfull"><span class="mut">Reason for exit</span><div class="rbox${t.xr ? "" : " empty"}" data-n="${t.id}" role="button" tabindex="0">${t.xr ? esc(t.xr.slice(0, 90)) + (t.xr.length > 90 ? "…" : "") : "Add reason"}</div></div>`}</details>
 ${openN === t.id ? `<div class="jnotes"><label>Reason for entry<textarea data-k="tth" data-id="${t.id}" rows="4" maxlength="2000" placeholder="Why did you take this trade?">${esc(t.th || "")}</textarea></label>${o ? "" : `<label>Reason for exit<textarea data-k="txr" data-id="${t.id}" rows="3" maxlength="2000" placeholder="Why did you close it? Stop, target, plan changed, fear...">${esc(t.xr || "")}</textarea></label>`}${t.ls ? "<p><b>Lessons:</b> " + esc(t.ls) + "</p>" : ""}</div>` : ""}
 <div class="jact">${coAskBtn(t)}${o ? `<button class="gh sm" data-a="cl" data-id="${t.id}">Close</button>` : `<button class="gh sm" data-a="ro" data-id="${t.id}">Reopen</button>`}<button class="gh sm" data-a="dl" data-id="${t.id}">Delete</button></div></article>`;
      })
      .join("") +
    `</div>`
  );
}
