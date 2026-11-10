/*
 * 12-long-term.js — part of the TradeInk app script.
 *
 * Long-term portfolio (indexes, funds and stocks held for the long run).
 * - Holdings with monthly/weekly deposits, live prices, totals and allocation.
 * - A compound-interest projection calculator.
 * - Opens as a side panel (#ltw). Adds its own Hebrew texts to HE at the end.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

/* ---- Long-term investments (side drawer). Kept separate from trading stats. ---- */
// Deposit frequency: deposits per year.
const LTF = { w: 52, m: 12, y: 1 };
// Long-term panel state.
let ltOpen = false,
  ltTab = "h",
  ltX = null;
// New holding id.
const ltId = () => "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// The long-term data (created if missing).
const ltD = () => {
  if (!S.lt || !Array.isArray(S.lt.h)) S.lt = { h: [], pj: { f: "m" } };
  return S.lt;
};
// Check and repair long-term data.
function ltClean(v) {
  const n = x => {
      x = parseFloat(x);
      return isFinite(x) ? x : null;
    },
    ds = x => (/^\d{4}-\d{2}-\d{2}$/.test(x) ? x : ""),
    id = x => (/^[\w-]{1,40}$/.test(x) ? x : ltId());
  v = v && typeof v === "object" ? v : {};
  const h = (Array.isArray(v.h) ? v.h : []).slice(0, 100).map(x => {
    const r =
      x && x.r && typeof x.r === "object"
        ? {
            a: n(x.r.a),
            f: LTF[x.r.f] ? x.r.f : "m",
            s: ds(x.r.s),
            k: Math.max(0, Math.min(5000, parseInt(x.r.k) || 0)),
            on: !!x.r.on
          }
        : null;
    return {
      id: id(x?.id),
      t: String(x?.t ?? "")
        .toUpperCase()
        .replace(/[^A-Z0-9.\-]/g, "")
        .slice(0, 10),
      nm: String(x?.nm ?? "").slice(0, 40),
      why: String(x?.why ?? "").slice(0, 300),
      tp: n(x?.tp) > 0 ? n(x?.tp) : null,
      q0: n(x?.q0),
      p0: n(x?.p0),
      mp: n(x?.mp),
      dp: (Array.isArray(x?.dp) ? x.dp : [])
        .slice(0, 2000)
        .map(y => ({ id: id(y?.id), d: ds(y?.d), a: n(y?.a), p: n(y?.p), q: n(y?.q) })),
      r
    };
  });
  const p = v.pj && typeof v.pj === "object" ? v.pj : {};
  return { h, pj: { i: n(p.i), a: n(p.a), f: LTF[p.f] ? p.f : "m", y: n(p.y), r: n(p.r) } };
}
// Tickers of the holdings.
const ltSyms = () =>
  ltD()
    .h.map(h => h.t)
    .filter(t => /^[A-Z0-9.\-]{1,10}$/.test(t));
// Price of a holding (live, or typed by hand).
const ltPx = h => (h.t && S.px && S.px[h.t] != null ? S.px[h.t] : h.mp);
// Where a holding's price comes from.
const ltSrc = h =>
  h.t && S.px && S.px[h.t] != null ? "Live price" : h.mp != null ? "Manual price" : "No price yet";
// Totals for one holding (invested, units, value).
function ltH(h) {
  let inv = (h.q0 || 0) * (h.p0 || 0),
    u = h.q0 || 0;
  for (const d of h.dp) {
    inv += d.a || 0;
    u += d.q || 0;
  }
  const p = ltPx(h),
    val = p != null ? u * p : null;
  return { inv, u, avg: u ? inv / u : null, p, val, pl: val != null ? val - inv : null };
}
// Totals for all holdings.
function ltTot() {
  let inv = 0,
    val = 0,
    miss = 0;
  for (const h of ltD().h) {
    const s = ltH(h);
    inv += s.inv;
    if (s.val != null) val += s.val;
    else {
      val += s.inv;
      if (s.inv) miss++;
    }
  }
  return { inv, val, pl: val - inv, miss };
}
/* Planned deposit k (0,1,2...) counted from the start date, so the 31st stays the 31st (or the month's last day). */
// Next date after adding a week / month / year.
function ltDate(s, f, k) {
  const [y, m, d] = s.split("-").map(Number);
  if (f === "w") {
    const x = new Date(y, m - 1, d + 7 * k);
    return dkey(x);
  }
  const mm = f === "y" ? m - 1 : m - 1 + k,
    yy = f === "y" ? y + k : y,
    last = new Date(yy, mm + 1, 0).getDate();
  return dkey(new Date(yy, mm, Math.min(d, last)));
}
// Next deposit date of a holding.
const ltNext = h => (h.r && h.r.on && h.r.s ? ltDate(h.r.s, h.r.f, h.r.k) : null);
// Holdings with a deposit due.
const ltDue = () =>
  ltD().h.filter(h => {
    const d = ltNext(h);
    return d && d <= dkey(new Date());
  });
// Percent text with color.
const ltPct = (v, b) =>
  b > 0 ? `<span class="ltn">${(v > 0 ? "+" : "") + ((v / b) * 100).toFixed(1)}%</span>` : "";
// pos / neg class for a value.
const ltCls = v => (v > 0 ? "pos" : v < 0 ? "neg" : "");
// Holding name for display (escaped).
const ltNm = h => (h.t || h.nm ? esc(h.t) + (h.t && h.nm ? " · " : "") + esc(h.nm) : "New holding");
// Number input HTML.
const ltIn = (lab, f, v, x = "") =>
  `<label>${lab}<input type="number" step="any" inputmode="decimal" data-lf="${f}" value="${v ?? ""}"${x}></label>`;
// HTML of the holdings list.
function ltHold() {
  const L = ltD(),
    T = ltTot();
  let o = `<div class="ltk"><div class="k"><small>Total value</small><b>${$f(T.val, 0)}</b></div><div class="k"><small>Deposited</small><b>${$f(T.inv, 0)}</b></div><div class="k"><small>P&L</small><b class="${ltCls(T.pl)}"><span class="ltn">${(T.pl > 0 ? "+" : "") + $f(T.pl, 0)}</span> ${ltPct(T.pl, T.inv)}</b></div></div>`;
  if (T.miss)
    o += `<p class="mut sm ltp">Some holdings have no price yet, so they are counted at what you deposited.</p>`;
  for (const h of ltDue()) {
    const p = ltPx(h);
    o += `<div class="ltdue" data-id="${h.id}"><b>Planned deposit due</b><div class="mut ltdm"><span>${ltNm(h)}</span> · <span class="ltn">${ltNext(h)}</span></div><div class="ltg2">${ltIn("Amount ($)", "ra", h.r.a)}${ltIn("Price ($)", "rp", p != null ? +p.toFixed(4) : "")}</div><p><button class="sm" data-l="rec" data-id="${h.id}">Record</button> <button class="gh sm" data-l="skip" data-id="${h.id}">Skip</button></p></div>`;
  }
  for (const h of L.h) {
    const s = ltH(h),
      op = ltX === h.id;
    o += `<div class="lth2"><button class="ltr1" data-l="ex" data-id="${h.id}" aria-expanded="${op}"><span>${op ? "▾" : "▸"} ${ltNm(h)}</span><span class="ltn">${s.val != null ? $f(s.val, 0) : "–"}${ltShare(s)}</span></button><div class="ltr2"><span><span class="ltn">${+s.u.toFixed(4)}</span> <span>units</span> · <span>Avg price</span> <span class="ltn">${s.avg != null ? $f(s.avg, 2) : "–"}</span></span><span class="${ltCls(s.pl)}">${s.pl != null ? ltPct(s.pl, s.inv) : ""}</span></div>${h.tp ? `<div class="ltr2"><span><span>Target price</span> <span class="ltn">${$f(h.tp, 2)}</span>${s.p ? ` <span class="ltn">(${(h.tp / s.p - 1) * 100 > 0 ? "+" : ""}${((h.tp / s.p - 1) * 100).toFixed(1)}%)</span>` : ""}</span></div>` : ""}${!op && s.p == null && ltMsg[h.id] ? `<p class="sm ltp ltmsg">${ltMsg[h.id]}</p>` : ""}`;
    if (op) {
      const r = h.r || { a: null, f: "m", s: "", k: 0, on: false };
      o += `<div class="ltbody" data-id="${h.id}"><div class="ltg2"><label>Symbol<input data-lf="t" value="${esc(h.t)}" maxlength="10" autocapitalize="characters" placeholder="VOO, QQQ or AAPL" style="text-transform:uppercase"></label><label>Name (optional)<input data-lf="nm" value="${esc(h.nm)}" maxlength="40" placeholder="S&amp;P 500"></label>${ltIn("Starting quantity", "q0", h.q0)}${ltIn("Starting avg price ($)", "p0", h.p0)}${ltIn("Target price ($), optional", "tp", h.tp)}<label class="ltwide">Why I bought<textarea data-lf="why" rows="2" maxlength="300" placeholder="For example: long-term growth of the 500 largest US companies">${esc(h.why || "")}</textarea></label></div>
   <div class="ltg2">${ltIn("Manual price ($)", "mp", h.mp)}<p class="mut sm ltp">${ltSrc(h)}${s.p != null ? ` <span class="ltn">${$f(s.p, 2)}</span>` : ""}. <span>Manual price is used only when there is no live price for this symbol.</span></p>${ltMsg[h.id] ? `<p class="sm ltp ltmsg" role="status">${ltMsg[h.id]}</p>` : ""}${h.t ? `<p class="ltg2f"><button class="gh sm ltbtn" data-l="px" data-id="${h.id}">↻ Refresh price</button></p>` : ""}</div>
   <h3>Deposit log</h3><table class="ltl"><thead><tr><th>Date</th><th>Amount</th><th>Price</th><th>Qty</th><th><span class="vh">Delete</span></th></tr></thead><tbody>${h.dp.length ? h.dp.map(d => `<tr data-di="${d.id}"><td><input class="dpk" readonly data-lf="dd" value="${d.d}" aria-label="Date"></td><td><input type="number" step="any" inputmode="decimal" data-lf="da" value="${d.a ?? ""}" aria-label="Amount"></td><td><input type="number" step="any" inputmode="decimal" data-lf="dp" value="${d.p ?? ""}" aria-label="Price"></td><td><input type="number" step="any" inputmode="decimal" data-lf="dq" value="${d.q ?? ""}" aria-label="Qty"></td><td><button class="gh sm ltdel" data-l="dd" data-id="${h.id}" data-di="${d.id}" aria-label="Delete deposit">✕</button></td></tr>`).join("") : `<tr><td colspan="5" class="mut">No deposits yet</td></tr>`}</tbody></table>
   <p><button class="gh sm ltbtn" data-l="da" data-id="${h.id}">+ Add deposit</button></p>
   <h3>Planned deposit</h3><div class="ltg2">${ltIn("Amount ($)", "ra2", r.a)}<label>How often<select data-lf="rf"><option value="w"${r.f === "w" ? " selected" : ""}>Weekly</option><option value="m"${r.f === "m" ? " selected" : ""}>Monthly</option><option value="y"${r.f === "y" ? " selected" : ""}>Yearly</option></select></label><label>Starts on<input class="dpk" readonly data-lf="rs" value="${r.s}" placeholder="YYYY-MM-DD"></label><label class="chk ltchk"><input type="checkbox" data-lf="ron"${r.on ? " checked" : ""}> Remind me to record it</label></div>
   ${r.on && r.s ? `<p class="mut sm ltp"><span>Next deposit</span>: <span class="ltn">${ltNext(h)}</span></p>` : ""}
   <p><button class="gh sm ltbtn ltrm" data-l="hd" data-id="${h.id}">Delete holding</button></p></div>`;
    }
    o += `</div>`;
  }
  o += `<p><button class="gh sm ltbtn" data-l="ha">+ Add holding</button></p><p class="mut sm ltp">You can add an index fund, an ETF or a single stock. For example: VOO (S&amp;P 500), QQQ (Nasdaq 100) or AAPL (Apple).</p><p class="mut sm ltp">Long-term deposits come out of your account cash, so they lower Free cash. Only their gain or loss changes your account value.</p>`;
  return o;
}
// HTML of the projection calculator.
function ltProj() {
  const P = ltD().pj;
  return `<div class="ltg2">${ltIn("Starting amount ($)", "pi", P.i, ' id="ltp-i"')}${ltIn("Deposit ($)", "pa", P.a, ' id="ltp-a"')}<label>How often<select data-lf="pf" id="ltp-f"><option value="w"${P.f === "w" ? " selected" : ""}>Weekly</option><option value="m"${P.f === "m" ? " selected" : ""}>Monthly</option><option value="y"${P.f === "y" ? " selected" : ""}>Yearly</option></select></label>${ltIn("Years", "py", P.y, ' id="ltp-y" min="1" max="60"')}${ltIn("Expected yearly return (%)", "pr", P.r, ' id="ltp-r"')}</div><div id="ltpr" aria-live="polite"></div><p class="ltwarn">Illustration only. The result depends entirely on the yearly return you enter. Real returns change from year to year and can be negative. This is not a promise of returns and not investment advice.</p>`;
}
// Run the compound-interest projection.
function ltCalc() {
  const out = $("ltpr");
  if (!out) return;
  const g = k => num(($("ltp-" + k) || {}).value),
    fv = ($("ltp-f") || {}).value,
    f = LTF[fv] ? fv : "m",
    i = Math.max(0, g("i") || 0),
    a = Math.max(0, g("a") || 0),
    y = Math.min(60, Math.max(0, Math.round(g("y") || 0))),
    r = Math.min(50, Math.max(-50, g("r") || 0)),
    n = LTF[f],
    rp = Math.pow(1 + r / 100, 1 / n) - 1;
  if (!y || (!i && !a)) {
    out.innerHTML = `<p class="mut sm ltp">Fill in an amount and the number of years to see the result.</p>`;
    return;
  }
  let b = i,
    dep = i;
  const pts = [[0, i, i]];
  for (let yr = 1; yr <= y; yr++) {
    for (let k = 0; k < n; k++) {
      b = b * (1 + rp) + a;
      dep += a;
    }
    pts.push([yr, b, dep]);
  }
  const W = 340,
    H = 150,
    L = 8,
    R = 8,
    Tp = 10,
    Bm = 22,
    mx = Math.max(...pts.map(p => Math.max(p[1], p[2])), 1),
    mn = Math.min(0, ...pts.map(p => p[1])),
    X = k => L + (k * (W - L - R)) / y,
    Y = v => Tp + ((mx - v) * (H - Tp - Bm)) / (mx - mn || 1),
    line = j => pts.map(p => X(p[0]).toFixed(1) + "," + Y(p[j]).toFixed(1)).join(" ");
  const ax = [0, Math.round(y / 2), y]
    .filter((v, i, A) => A.indexOf(v) === i)
    .map(
      k =>
        `<text x="${X(k)}" y="${H - 6}" font-size="11" text-anchor="${k === 0 ? "start" : k === y ? "end" : "middle"}" fill="var(--mut)">${k}</text>`
    )
    .join("");
  out.innerHTML = `<div class="ltk"><div class="k"><small>Final amount</small><b>${$f(b, 0)}</b></div><div class="k"><small>You deposited</small><b>${$f(dep, 0)}</b></div><div class="k"><small>Growth</small><b class="${ltCls(b - dep)}"><span class="ltn">${(b - dep > 0 ? "+" : "") + $f(b - dep, 0)}</span></b></div></div>
 <svg class="ltsvg" direction="ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="Projected growth chart"><line x1="${L}" x2="${W - R}" y1="${Y(Math.max(mn, 0))}" y2="${Y(Math.max(mn, 0))}" stroke="var(--line)"/><polyline fill="none" stroke="var(--mut)" stroke-width="2" stroke-dasharray="5 4" points="${line(2)}"/><polyline fill="none" stroke="var(--ac)" stroke-width="2.5" points="${line(1)}"/>${ax}</svg>
 <p class="ltlg"><span class="ltsw" style="background:var(--ac)"></span> <span>Estimated value</span> &nbsp; <span class="ltsw ltsd"></span> <span>You deposited</span> &nbsp; <span class="mut">(<span>Years</span>)</span></p>`;
}
// A holding's share of the portfolio.
function ltShare(s) {
  const T = ltTot();
  return s.val != null && T.val > 0
    ? ` <small class="ltsh">${Math.round((s.val / T.val) * 100)}%</small>`
    : "";
}
// HTML of the whole long-term panel.
function ltPageHTML() {
  return (
    `<div class="lthd"><h2>Portfolio</h2></div><div class="ltt"><button class="${ltTab === "h" ? "on" : "gh"} sm" data-l="tab" data-v="h" aria-pressed="${ltTab === "h"}">Holdings</button><button class="${ltTab === "p" ? "on" : "gh"} sm" data-l="tab" data-v="p" aria-pressed="${ltTab === "p"}">Projection</button></div>` +
    (ltTab === "h" ? ltHold() : ltProj())
  );
}
// Draw the long-term panel.
function ltRender() {
  const w = $("ltw");
  if (!w) return;
  w.hidden = !ltOpen;
  document.documentElement.classList.toggle("lto", ltOpen);
  if (!ltOpen) {
    const pg = $("ltpg");
    if (pg && tab === "pf") {
      pg.innerHTML = ltPageHTML();
      if (ltTab === "p") ltCalc();
    }
    return;
  }
  const a = document.activeElement,
    fid =
      a && w.contains(a)
        ? a.dataset.l
          ? "[data-l='" +
            a.dataset.l +
            "']" +
            (a.dataset.id ? "[data-id='" + a.dataset.id + "']" : "")
          : null
        : null;
  $("ltd").innerHTML =
    `<div class="lthd"><h2 id="lthh">Long-term investments</h2><button class="gh sm ltbtn" id="ltx" data-l="x">✕ Close</button></div><div class="ltt"><button class="${ltTab === "h" ? "on" : "gh"} sm" data-l="tab" data-v="h" aria-pressed="${ltTab === "h"}">Holdings</button><button class="${ltTab === "p" ? "on" : "gh"} sm" data-l="tab" data-v="p" aria-pressed="${ltTab === "p"}">Projection</button></div>` +
    (ltTab === "h" ? ltHold() : ltProj());
  if (ltTab === "p") ltCalc();
  if (fid) {
    const e = $("ltd").querySelector(fid);
    if (e) e.focus();
  }
}
// Update the Long-term button (hidden when logged out, due-deposit count).
function ltSync() {
  const b = $("ltb");
  if (b) {
    b.hidden = !!(FB && !U);
    const n = ltDue().length;
    b.classList.toggle("ltdot", n > 0);
  }
  if (FB && !U) ltOpen = false;
  ltRender();
}
// Open or close the long-term panel.
function ltShow(v) {
  ltOpen = v;
  ltRender();
  if (v) ltFetch(ltStale());
  if (v) {
    const x = $("ltx");
    if (x) x.focus();
  } else {
    const b = $("ltb");
    if (b) b.focus();
  }
}
// Long-term block on the dashboard.
function ltDash(net) {
  const L = ltD();
  if (!L.h.length) return "";
  const T = ltTot(),
    A = acct();
  return `<div class="card ltrow"><div class="lthd"><h2>Long-term investments</h2><button class="gh sm ltbtn" data-l="open">Open</button></div><div class="kp"><div class="k"><small>Total value</small><b>${$f(T.val, 0)}</b></div><div class="k"><small>Deposited</small><b>${$f(T.inv, 0)}</b></div><div class="k"><small>P&L (long-term)</small><b class="${ltCls(T.pl)}"><span class="ltn">${(T.pl > 0 ? "+" : "") + $f(T.pl, 0)}</span></b></div><div class="k"><small>Total P&L (closed trades + long-term)</small><b class="${ltCls(net + T.pl)}"><span class="ltn">${(net + T.pl > 0 ? "+" : "") + $f(net + T.pl, 0)}</span></b></div><div class="k"><small>Total account value</small><b>${$f(A + T.pl, 0)}</b></div></div><p class="mut sm ltp">Win rate, R and average trade above count trading only.</p></div>`;
}
// Find a holding by id.
function ltFind(id) {
  return ltD().h.find(h => h.id === id);
}
// Messages per holding (price loading).
const ltMsg = {};
// Price loading state.
let ltBusy = false;
// Redraw without losing the field being typed in.
function ltSoft() {
  const a = document.activeElement;
  if (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  view();
}
// Load live prices for holdings.
async function ltFetch(list) {
  list = list.filter(h => /^[A-Z0-9.\-]{1,10}$/.test(h.t));
  if (ltBusy || !list.length) return;
  if (!FK) {
    list.forEach(h => (ltMsg[h.id] = "The price key was not accepted."));
    return ltSoft();
  }
  ltBusy = true;
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    ltMsg[h.id] = "Loading price...";
    ltSoft();
    let m = "";
    try {
      const r = await fetch(
        "https://finnhub.io/api/v1/quote?symbol=" +
          encodeURIComponent(h.t) +
          "&token=" +
          encodeURIComponent(FK)
      );
      if (r.status === 401 || r.status === 403) m = "The price key was not accepted.";
      else if (r.status === 429) m = "Too many price requests right now. Try again in a minute.";
      else {
        const d = await r.json();
        if (d && d.c > 0) {
          S.px = S.px || {};
          S.pxT = S.pxT || {};
          S.px[h.t] = d.c;
          S.pxT[h.t] = Date.now();
        } else m = "Finnhub has no price for this symbol. Enter a manual price.";
      }
    } catch (e) {
      m = "Could not reach the price service. Check your connection and try again.";
    }
    ltMsg[h.id] = m;
    if (i < list.length - 1) await pause(1100);
  }
  ltBusy = false;
  save();
  ltSoft();
}
// Holdings without a fresh price.
const ltStale = () =>
  ltD().h.filter(
    h => h.t && !(S.px && S.px[h.t] != null && S.pxT && Date.now() - S.pxT[h.t] < 18e5)
  );
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-l]");
  if (!b || b.tagName !== "BUTTON") return;
  const a = b.dataset.l,
    h = b.dataset.id ? ltFind(b.dataset.id) : null,
    L = ltD();
  if (a === "open") return ltShow(true);
  if (a === "x") return ltShow(false);
  if (a === "tab") {
    ltTab = b.dataset.v === "p" ? "p" : "h";
    return ltRender();
  }
  if (a === "ex") {
    ltX = ltX === b.dataset.id ? null : b.dataset.id;
    return ltRender();
  }
  if (a === "ha") {
    if (L.h.length >= 100) return;
    const n = { id: ltId(), t: "", nm: "", q0: null, p0: null, mp: null, dp: [], r: null };
    L.h.push(n);
    ltX = n.id;
    save();
    ltRender();
    const s = $("ltd").querySelector(`.ltbody[data-id="${n.id}"] input[data-lf="t"]`);
    if (s) s.focus();
    return;
  }
  if (!h) return;
  if (a === "px") {
    ltFetch([h]);
    return;
  }
  if (a === "hd") {
    if (!cf("Delete this holding and its deposit log?")) return;
    L.h = L.h.filter(x => x !== h);
    ltX = null;
  } else if (a === "da") {
    const p = ltPx(h);
    h.dp.unshift({
      id: ltId(),
      d: dkey(new Date()),
      a: null,
      p: p != null ? +p.toFixed(4) : null,
      q: null
    });
  } else if (a === "dd") {
    h.dp = h.dp.filter(d => d.id !== b.dataset.di);
  } else if (a === "rec" || a === "skip") {
    const box = b.closest(".ltdue");
    if (a === "rec") {
      const am = num(box.querySelector('[data-lf="ra"]').value),
        p = num(box.querySelector('[data-lf="rp"]').value);
      if (!(am > 0)) {
        al("Enter the deposit amount.");
        return;
      }
      if (!(p > 0)) {
        al("Enter the price on the deposit day.");
        return;
      }
      h.dp.unshift({ id: ltId(), d: ltNext(h), a: am, p, q: +(am / p).toFixed(6) });
      h.dp.sort((x, y) => (x.d < y.d ? 1 : -1));
      toast(tr("Deposit recorded"));
    }
    h.r.k++;
  } else return;
  save();
  view();
});
document.addEventListener("change", e => {
  const el = e.target,
    f = el.dataset && el.dataset.lf;
  if (!f) return;
  const v = el.value;
  if (/^p[iafyr]$/.test(f)) {
    const P = ltD().pj;
    if (f === "pf") P.f = LTF[v] ? v : "m";
    else P[f[1]] = num(v);
    save();
    return ltCalc();
  }
  const box = el.closest("[data-id]"),
    h = box ? ltFind(box.dataset.id) : null;
  if (!h || f === "ra" || f === "rp") return;
  if (f === "t") {
    h.t = v
      .toUpperCase()
      .replace(/[^A-Z0-9.\-]/g, "")
      .slice(0, 10);
    // The screening is finished once the stock is a long-term holding.
    if (h.t && scrDone()) scrNew();
    delete ltMsg[h.id];
    save();
    view();
    ltFetch([h]);
    return;
  }
  if (f === "nm") h.nm = v.slice(0, 40);
  else if (f === "why") h.why = v.slice(0, 300);
  else if (f === "tp") {
    const n = num(v);
    h.tp = n > 0 ? n : null;
  } else if (f === "q0" || f === "p0" || f === "mp") {
    const n = num(v);
    h[f] = n != null && n >= 0 ? n : null;
  } else if (/^d[dapq]$/.test(f)) {
    const tr0 = el.closest("[data-di]"),
      d = tr0 && h.dp.find(x => x.id === tr0.dataset.di);
    if (!d) return;
    const n = num(v);
    if (f === "dd") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        d.d = v;
        h.dp.sort((x, y) => (x.d < y.d ? 1 : -1));
      }
    } else if (f === "dq") d.q = n > 0 ? n : null;
    else {
      d[f === "da" ? "a" : "p"] = n > 0 ? n : null;
      if (d.a > 0 && d.p > 0) d.q = +(d.a / d.p).toFixed(6);
    }
  } else {
    h.r = h.r || { a: null, f: "m", s: "", k: 0, on: false };
    if (f === "ra2") h.r.a = num(v) > 0 ? num(v) : null;
    else if (f === "rf") {
      h.r.f = LTF[v] ? v : "m";
      h.r.k = 0;
    } else if (f === "rs") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        h.r.s = v;
        h.r.k = 0;
      }
    } else if (f === "ron") {
      h.r.on = el.checked;
      if (el.checked && !h.r.s) h.r.s = dkey(new Date());
    }
  }
  save();
  view();
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset && /^p[iafyr]$/.test(el.dataset.lf || "")) ltCalc();
});
document.addEventListener("keydown", e => {
  if (!ltOpen) return;
  if (e.key === "Escape") {
    if (document.querySelector(".calw")) return;
    ltShow(false);
    return;
  }
  if (e.key === "Tab") {
    const F = [...$("ltd").querySelectorAll("button,input,select,[tabindex]")].filter(
      x => !x.disabled && x.offsetParent !== null
    );
    if (!F.length) return;
    const f0 = F[0],
      f1 = F[F.length - 1];
    if (e.shiftKey && document.activeElement === f0) {
      e.preventDefault();
      f1.focus();
    } else if (!e.shiftKey && document.activeElement === f1) {
      e.preventDefault();
      f0.focus();
    }
  }
});
$("ltb").onclick = () => ltShow(!ltOpen);
$("ltov").onclick = () => ltShow(false);
Object.assign(HE, {
  "Long-term": "טווח ארוך",
  "Long-term investments": "השקעות לטווח ארוך",
  "Holdings": "החזקות",
  "Projection": "תחזית",
  "✕ Close": "✕ סגירה",
  "Total value": "שווי כולל",
  "Deposited": "הופקד",
  "Some holdings have no price yet, so they are counted at what you deposited.":
    "לחלק מההחזקות אין מחיר עדיין, ולכן הן נספרות לפי מה שהופקד.",
  "Planned deposit due": "הפקדה קבועה ממתינה",
  "Amount ($)": "סכום ($)",
  "Price ($)": "מחיר ($)",
  "Record": "לרשום",
  "Skip": "לדלג",
  "New holding": "החזקה חדשה",
  "units": "יחידות",
  "Avg price": "מחיר ממוצע",
  "Symbol": "סימול",
  "Name (optional)": "שם (לא חובה)",
  "Starting quantity": "כמות התחלתית",
  "Starting avg price ($)": "מחיר ממוצע התחלתי ($)",
  "Manual price ($)": "מחיר ידני ($)",
  "Live price": "מחיר חי",
  "Manual price": "מחיר ידני",
  "No price yet": "אין מחיר עדיין",
  "Manual price is used only when there is no live price for this symbol.":
    "המחיר הידני משמש רק כשאין מחיר חי לסימול הזה.",
  "Deposit log": "יומן הפקדות",
  "Amount": "סכום",
  "Price": "מחיר",
  "Qty": "כמות",
  "No deposits yet": "אין הפקדות עדיין",
  "Delete deposit": "מחיקת הפקדה",
  "+ Add deposit": "+ הוספת הפקדה",
  "Planned deposit": "הפקדה קבועה",
  "How often": "כל כמה זמן",
  "Weekly": "שבועי",
  "Monthly": "חודשי",
  "Yearly": "שנתי",
  "Starts on": "מתחילה בתאריך",
  "Remind me to record it": "להזכיר לי לרשום אותה",
  "Next deposit": "ההפקדה הבאה",
  "Delete holding": "מחיקת החזקה",
  "+ Add holding": "+ הוספת החזקה",
  "Long-term deposits come out of your account cash, so they lower Free cash. Only their gain or loss changes your account value.":
    "הפקדות לטווח ארוך יוצאות מהמזומן שבחשבון, ולכן הן מקטינות את המזומן הפנוי. רק הרווח או ההפסד שלהן משנה את שווי החשבון.",
  "Starting amount ($)": "סכום התחלתי ($)",
  "Deposit ($)": "הפקדה ($)",
  "Years": "שנים",
  "Expected yearly return (%)": "תשואה שנתית משוערת (%)",
  "Illustration only. The result depends entirely on the yearly return you enter. Real returns change from year to year and can be negative. This is not a promise of returns and not investment advice.":
    "להמחשה בלבד. התוצאה תלויה כולה בתשואה השנתית שהזנת. תשואות אמיתיות משתנות משנה לשנה ויכולות להיות שליליות. זו לא הבטחת תשואה ולא ייעוץ השקעות.",
  "Fill in an amount and the number of years to see the result.":
    "מלא סכום ומספר שנים כדי לראות את התוצאה.",
  "Final amount": "סכום סופי",
  "You deposited": "הפקדת",
  "Growth": "רווח",
  "Projected growth chart": "גרף צמיחה משוער",
  "Estimated value": "שווי משוער",
  "Open": "פתיחה",
  "P&L (long-term)": "רווח/הפסד (טווח ארוך)",
  "Total P&L (closed trades + long-term)": "רווח/הפסד כולל (עסקאות סגורות + טווח ארוך)",
  "Total account value": "שווי חשבון כולל",
  "Win rate, R and average trade above count trading only.":
    "אחוז ההצלחה, ה-R והעסקה הממוצעת למעלה מחושבים על המסחר בלבד.",
  "Delete this holding and its deposit log?": "למחוק את ההחזקה ואת יומן ההפקדות שלה?",
  "Enter the deposit amount.": "הזן את סכום ההפקדה.",
  "Enter the price on the deposit day.": "הזן את המחיר ביום ההפקדה.",
  "Deposit recorded": "ההפקדה נרשמה",
  "Long-term investments, open panel": "השקעות לטווח ארוך, פתיחת חלונית",
  "Long-term value": "שווי טווח ארוך",
  "More": "עוד",
  "Loading price...": "טוען מחיר...",
  "The price key was not accepted.": "מפתח המחירים לא התקבל.",
  "Too many price requests right now. Try again in a minute.":
    "יותר מדי בקשות מחיר כרגע. נסה שוב בעוד דקה.",
  "Finnhub has no price for this symbol. Enter a manual price.":
    "ל-Finnhub אין מחיר לסימול הזה. הזן מחיר ידני.",
  "Could not reach the price service. Check your connection and try again.":
    "לא הצלחנו להגיע לשירות המחירים. בדוק את החיבור ונסה שוב.",
  "↻ Refresh price": "↻ רענון מחיר",
  "Trading P&L": "רווח/הפסד מסחר",
  "Long-term P&L": "רווח/הפסד טווח ארוך"
});
