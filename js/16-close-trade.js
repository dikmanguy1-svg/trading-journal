/*
 * 16-close-trade.js — part of the Trading.Journal app script.
 *
 * The "close trade" window: exit price, how it ended (target / stop /
 * breakeven / manual), reason, mood and lessons.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

/* Close-a-trade window: exit price, how it ended (pre-picked from the price, can be changed), reason, mindset, lesson */
// Guess how a trade ended from the exit price.
const rsGuess = (t, x) =>
  Math.abs(x - t.e) <= t.e * 0.002
    ? RSL[2]
    : t.s != null && (t.dir === "Long" ? x <= t.s : x >= t.s)
      ? RSL[1]
      : t.tg != null && (t.dir === "Long" ? x >= t.tg : x <= t.tg)
        ? RSL[0]
        : RSL[3];
// The close-trade window state.
let CL = null;
// Open the close-trade window.
function clOpen(id) {
  const t = S.trades.find(x => x.id === id);
  if (!t) return;
  CL = { id, rs: "", man: false, m: null, back: document.activeElement };
  const px = typeof lp === "function" ? lp(t) : null;
  const d = document.createElement("div");
  d.id = "clw";
  d.innerHTML = `<div class="clov" data-clx></div><div class="cld" role="dialog" aria-modal="true" aria-labelledby="clh"><h2 id="clh"><span>Close trade</span> <b data-nt>${esc(t.t)}</b></h2>
 <label class="clf">Exit price<input id="clp" type="number" step="any" inputmode="decimal" value="${px != null ? (+px).toFixed(2) : ""}" required></label>
 <div class="clf"><span id="clrl">How did it end?</span><div class="chips" role="group" aria-labelledby="clrl">${RSL.map((r, i) => `<button type="button" class="chip" data-cr="${i}" aria-pressed="false">${r}</button>`).join("")}</div><small class="mut" id="clhint">Picked from the price. Tap to change.</small></div>
 <label class="clf">Reason for exit (optional)<textarea id="clr" rows="2" maxlength="2000" placeholder="Why did you close it? Stop, target, plan changed, fear..."></textarea></label>
 <div class="clf"><span id="clml">Mindset 1-5 (optional)</span><div class="chips" role="group" aria-labelledby="clml">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="chip" data-cm="${n}" aria-pressed="false">${n}</button>`).join("")}</div></div>
 <label class="clf">Lessons / notes (optional)<textarea id="cll" rows="2" maxlength="2000"></textarea></label>
 <p class="clmsg" id="clmsg" role="alert"></p><div class="clbt"><button type="button" class="gh" data-clx>Cancel</button><button type="button" class="cta" id="clok">Close trade</button></div></div>`;
  document.body.appendChild(d);
  clPick();
  setTimeout(() => {
    const i = $("clp");
    if (i) i.focus();
  }, 30);
}
// Update the guessed exit reason while typing the price.
function clPick() {
  if (!CL) return;
  const t = S.trades.find(x => x.id === CL.id),
    x = num(($("clp") || {}).value);
  if (!CL.man) CL.rs = x != null && t ? rsGuess(t, x) : "";
  document.querySelectorAll("#clw [data-cr]").forEach(b => {
    const on = RSL[+b.dataset.cr] === CL.rs;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll("#clw [data-cm]").forEach(b => {
    const on = +b.dataset.cm === CL.m;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  const h = $("clhint");
  if (h) h.hidden = CL.man || !CL.rs;
}
// Close the window and return focus.
function clClose() {
  const w = $("clw");
  if (w) w.remove();
  const b = CL && CL.back;
  CL = null;
  if (b && b.focus && document.contains(b)) b.focus();
}
document.addEventListener("input", e => {
  if (e.target.id === "clp") clPick();
});
document.addEventListener("click", e => {
  if (!CL) return;
  const t = e.target;
  if (t.closest("[data-clx]")) {
    clClose();
    return;
  }
  const r = t.closest("[data-cr]");
  if (r) {
    CL.rs = RSL[+r.dataset.cr];
    CL.man = true;
    clPick();
    return;
  }
  const m = t.closest("[data-cm]");
  if (m) {
    CL.m = CL.m === +m.dataset.cm ? null : +m.dataset.cm;
    clPick();
    return;
  }
  if (t.closest("#clok")) {
    const x = num($("clp").value);
    if (x == null || !(x > 0)) {
      $("clmsg").textContent = tr("Enter the exit price.");
      $("clp").focus();
      return;
    }
    const tr0 = S.trades.find(q => q.id === CL.id);
    if (!tr0) {
      clClose();
      return;
    }
    tr0.x = x;
    tr0.xd = dkey(new Date());
    tr0.rs = CL.rs || rsGuess(tr0, x);
    if (CL.m) tr0.m = CL.m;
    const xr = $("clr").value.trim();
    if (xr) tr0.xr = xr.slice(0, 2000);
    const l = $("cll").value.trim();
    if (l) tr0.ls = l.slice(0, 2000);
    clClose();
    save();
    view();
    if (typeof toast === "function") toast(tr("Trade closed"));
  }
});
document.addEventListener("keydown", e => {
  if (CL && e.key === "Escape") {
    e.preventDefault();
    clClose();
  }
  if (CL && e.key === "Enter" && e.target.id === "clp") {
    e.preventDefault();
    $("clok").click();
  }
});
