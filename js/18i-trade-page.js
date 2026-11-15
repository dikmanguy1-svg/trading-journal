/*
 * 18i-trade-page.js — part of the TradeInk app script.
 *
 * A trade's notebook page (15.11): press a trade in the Trade journal (a row on a computer,
 * a card on a phone) and its page opens. Everything about the trade is written and changed there:
 * the plan (date, ticker, side, entry, stop, target, shares, mindset), why I entered,
 * and after closing: exit price, exit date, how it ended, why I exited, lessons and my rules.
 * Fields with data-k are saved by the journal code in js/06 (same as before);
 * ticker, side, mindset and lessons (data-tp) are saved here.
 * Also: the scanner is called "Stocks scanner" in the menu (the tab itself is in js/18e).
 * Looks: css/13-ink-paper.css (".tp...").
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// The open page: id of the trade, and where to go back to.
let TP = null;

// The scanner's name in the menu (15.11). The tab's own title is in js/18e-scanner.js.
(() => {
  const s = T.find(x => x[0] === "scan");
  if (s) s[1] = "Stocks scanner";
})();
HE["Stocks scanner"] = "סורק מניות";

function tpOpen(id) {
  if (!S.trades.some(t => t.id === id)) return;
  if (!TP) TP = { back: document.activeElement };
  TP.id = id;
  let d = $("tpw");
  if (!d) {
    d = document.createElement("div");
    d.id = "tpw";
    document.body.appendChild(d);
    document.body.classList.add("tp-on");
  }
  tpDraw(true);
}

function tpClose() {
  const d = $("tpw");
  if (d) d.remove();
  document.body.classList.remove("tp-on");
  const b = TP && TP.back;
  TP = null;
  if (b && b.isConnected && b.focus) b.focus();
}

// A labeled field. k = data-k (saved by js/06) or p = data-tp (saved here).
const tpNum = (lab, v, id, k) =>
  `<label class="tpf"><span>${lab}</span><input type="number" step="any" inputmode="decimal" data-k="${k}" data-id="${id}" value="${v ?? ""}"></label>`;

function tpDraw(first) {
  const d = $("tpw"),
    t = TP && S.trades.find(x => x.id === TP.id);
  if (!d) return;
  if (!t) return tpClose();
  // Keep the cursor in the same field after a redraw.
  const a = document.activeElement,
    fk = a && d.contains(a) ? a.dataset.k || a.dataset.tp || a.dataset.a || "" : "";
  const o = t.x == null,
    p = pnl(t) ?? fl(t),
    now = o ? lp(t) : null,
    rv = rr(t),
    rsk = risk(t),
    c = cost(t);
  d.innerHTML = `<div class="tpov" data-tpx></div><div class="tpd" role="dialog" aria-modal="true" aria-labelledby="tph">
<div class="tptop"><p class="hk" aria-hidden="true">${o ? "still in the trade —" : "the trade, start to finish —"}</p><button type="button" class="tpx" data-tpx aria-label="Close">×</button></div>
<div class="tphd"><h2 id="tph"><span data-nt>${esc(t.t)}</span></h2><span class="tpb">${t.dir === "Short" ? "Short" : "Long"}</span><span class="tpb ${o ? "tpo" : "tpc"}">${o ? "Open trade" : "Closed trade"}</span><span class="tpsp"></span><span class="tppl"><small>P&amp;L</small><b class="${p > 0 ? "pos" : p < 0 ? "neg" : ""}" data-nt>${p == null ? "–" : $f(p, 2)}</b></span><span class="tppl"><small>R</small><b>${rCell(t)}</b></span></div>
<section class="tps"><h3>The plan</h3><div class="tpg">
<label class="tpf"><span>Entry date</span><input type="text" readonly class="dpk" data-k="tdt" data-id="${t.id}" value="${esc(t.d)}"></label>
<label class="tpf"><span>Ticker</span><input data-tp="t" maxlength="10" value="${esc(t.t)}" style="text-transform:uppercase"></label>
<label class="tpf"><span>Direction</span><select data-tp="dir"><option value="Long"${t.dir !== "Short" ? " selected" : ""}>Long</option><option value="Short"${t.dir === "Short" ? " selected" : ""}>Short</option></select></label>
${tpNum("Entry price", t.e, t.id, "te")}${tpNum("Stop", t.s, t.id, "ts")}${tpNum("Target", t.tg, t.id, "tg")}${tpNum("Shares", t.sh, t.id, "tsh")}
<label class="tpf"><span>Mindset (1-5)</span><select data-tp="m"><option value="">–</option>${[1, 2, 3, 4, 5].map(n => `<option${t.m === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>${ddShowTimes(t) ? ddTimeField(t, "tm", "Entry time") : ""}
</div>
<p class="tpk"><span><small>Size</small> <b data-nt>${$f(c, 0)}</b> <small class="mut" data-nt>${((c / acct()) * 100).toFixed(1)}%</small></span><span><small>Risk $</small> <b data-nt>${rsk == null ? "–" : $f(rsk, 0)}</b></span><span><small>Plan R:R</small> <b data-nt>${rv == null ? "–" : rv.toFixed(1)}</b></span>${o ? `<span><small>Current price</small> <b data-nt>${now == null ? "–" : $f(now, 2)}</b></span>` : ""}</p>
<label class="tpw"><span>Why I entered</span><textarea data-k="tth" data-id="${t.id}" rows="3" maxlength="2000" placeholder="Why did you take this trade?">${esc(t.th || "")}</textarea></label></section>
${
  o
    ? `<section class="tps"><h3>The exit</h3><p class="mut">The trade is still open.</p><button type="button" class="tpcl" data-a="cl" data-id="${t.id}">Close this trade</button></section>`
    : `<section class="tps"><h3>The exit</h3><div class="tpg">${tpNum("Exit price", t.x, t.id, "tx")}${ddShowTimes(t) ? ddTimeField(t, "xt", "Exit time") : ""}<label class="tpf"><span>Exit date</span><input type="text" readonly class="dpk" data-k="txd" data-id="${t.id}" value="${esc(t.xd || "")}" placeholder="Set date"></label><label class="tpf"><span>Exit type</span><select data-k="trs" data-id="${t.id}"><option value="">Choose</option>${RSL.map(x => `<option${t.rs === x ? " selected" : ""}>${x}</option>`).join("")}</select></label></div>
<label class="tpw"><span>Why I exited</span><textarea data-k="txr" data-id="${t.id}" rows="2" maxlength="2000" placeholder="Why did you close it? Stop, target, plan changed, fear...">${esc(t.xr || "")}</textarea></label>
<label class="tpw"><span>What I learned</span><textarea data-tp="ls" rows="2" maxlength="2000" placeholder="Write it in your own words…">${esc(t.ls || "")}</textarea></label>
${ddMistakes(t)}<div class="tpw"><span>My rules</span>${rkUI(t)}</div></section>`
}
<div class="tpft">${coAskBtn(t)}${o ? "" : `<button type="button" class="gh sm" data-a="ro" data-id="${t.id}">Reopen</button>`}<button type="button" class="gh sm tpdel" data-a="dl" data-id="${t.id}">Delete</button><span class="tpsp"></span><button type="button" class="tpok" data-tpx>Done</button></div>
</div>`;
  const f =
    (fk && d.querySelector(`[data-k="${fk}"],[data-tp="${fk}"],[data-a="${fk}"]`)) ||
    (first && d.querySelector(".tpx"));
  if (f) f.focus();
}

// Open a trade's page: a row on a computer, the ticker or reason on a phone card.
window.addEventListener(
  "click",
  e => {
    const el = e.target;
    if (!el.closest) return;
    const pg = $("tpw");
    if (pg && pg.contains(el)) {
      if (el.closest("[data-tpx]")) return tpClose();
      // Closing a trade and asking Wick open their own windows: this page steps aside first
      // (the click still reaches js/06 and js/14, which open them).
      if (el.closest("[data-a='cl'],[data-co]")) tpClose();
      return;
    }
    const n = el.closest("#v [data-n], #v tr[data-tpo], #v [data-tpo]");
    if (!n) return;
    // Buttons and fields inside a row keep their own job.
    if (n.tagName === "TR" && el.closest("button, input, select, textarea, a, label")) return;
    e.stopPropagation();
    e.preventDefault();
    tpOpen(n.dataset.tpo || n.dataset.n);
  },
  true
);
// Was a date picker open when the key was pressed? (Escape then closes only the date picker.)
let tpCal = false;
window.addEventListener("keydown", () => (tpCal = !!document.querySelector(".calw")), true);
// Enter on a reason box opens the page too (keyboard).
document.addEventListener("keydown", e => {
  const d = $("tpw");
  if (d && TP) {
    if (e.key === "Escape" && !tpCal) return tpClose();
    if (e.key === "Tab") {
      const f = [...d.querySelectorAll("button,input,select,textarea")].filter(
        x => !x.disabled && x.offsetParent
      );
      if (!f.length) return;
      const a = f[0],
        z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) (e.preventDefault(), z.focus());
      else if (!e.shiftKey && document.activeElement === z) (e.preventDefault(), a.focus());
    }
    return;
  }
  if (e.key !== "Enter" && e.key !== " ") return;
  const n = e.target.closest && e.target.closest("#v [data-n]");
  if (!n) return;
  e.preventDefault();
  tpOpen(n.dataset.n);
});

// Save ticker, side, mindset and lessons; redraw the page after any change (js/06 saves the rest).
document.addEventListener("change", e => {
  const d = $("tpw");
  if (!d || !TP || !d.contains(e.target)) return;
  const k = e.target.dataset.tp,
    t = S.trades.find(x => x.id === TP.id);
  if (k && t) {
    const v = e.target.value;
    if (k === "t") {
      const x = v.trim().toUpperCase().slice(0, 10);
      if (x) t.t = x;
    } else if (k === "dir") t.dir = v === "Short" ? "Short" : "Long";
    else if (k === "m") t.m = v ? Math.min(5, Math.max(1, +v)) : null;
    else if (k === "ls") t.ls = v.slice(0, 2000);
    else if (k === "tm" || k === "xt") t[k] = /^\d{2}:\d{2}$/.test(v) ? v : "";
    save();
    view();
  }
  setTimeout(() => tpDraw(), 0);
});
// Rule buttons and Reopen change the trade: redraw. Delete: the page closes by itself.
document.addEventListener("click", e => {
  const d = $("tpw");
  if (d && TP && d.contains(e.target) && e.target.closest("[data-a]"))
    setTimeout(() => tpDraw(), 0);
});
