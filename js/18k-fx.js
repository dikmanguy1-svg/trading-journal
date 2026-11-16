/*
 * 18k-fx.js — part of the TradeInk app script.
 *
 * Deposits, withdrawals and currency (16.11).
 * The account is in dollars, but your money comes from your home currency (ILS by default).
 * Each deposit or withdrawal keeps its date, the $ amount and the exchange rate of that day
 * (typed by you, or filled in from the historical rate). The Dashboard then splits the result:
 * - from the stocks:   (account value $ - net deposits $) x today's rate
 * - from the currency: sum of each deposit $ x (today's rate - its rate)
 * - total:             account value $ x today's rate - net deposits in home currency
 *   (the two parts always add up to the total).
 * Rates: Frankfurter (European Central Bank rates, free, no key), cached on this device (tj_fx).
 * Saved with the journal (S.fx, cleaned in js/04) — in the cloud for each user after logging in.
 * "Account size from my deposits" (on by default) makes the starting account size = net deposits.
 * The card is on the Portfolio tab; the split is on the Dashboard. Looks: css/13 (".fx...").
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Currencies with daily rates (European Central Bank list).
const FXC =
  "AUD BGN BRL CAD CHF CNY CZK DKK EUR GBP HKD HUF IDR ILS INR ISK JPY KRW MXN MYR NOK NZD PHP PLN RON SEK SGD THB TRY USD ZAR".split(
    " "
  );
const FXAPI = "https://api.frankfurter.dev/v1/";
// The saved part: home currency, sync with account size, the rows.
const fxD = () => {
  if (!S.fx) S.fx = { cur: "ILS", sync: true, d: [] };
  return S.fx;
};
// Rates fetched on this device: "ILS|2026-01-05" -> 3.71, "ILS|now" -> [rate, time, date].
let FXR = {};
try {
  FXR = JSON.parse(localStorage.getItem("tj_fx") || "{}") || {};
} catch (e) {
  FXR = {};
}
const fxKeep = () => {
  try {
    localStorage.setItem("tj_fx", JSON.stringify(FXR));
  } catch (e) {}
};
let fxBusy = false,
  fxErr = "",
  fxErrT = 0;
// Signed $ amount: deposits add, withdrawals take away.
const fxSg = r => (r.k === "w" ? -r.a : r.a);
// Today's rate for the home currency (null until loaded). USD at home: always 1.
const fxNow = () => {
  const c = fxD().cur;
  if (c === "USD") return 1;
  const n = FXR[c + "|now"];
  return n ? n[0] : null;
};
// Money in the home currency.
function fxMoney(v, c) {
  try {
    return new Intl.NumberFormat(LANG === "he" ? "he-IL" : "en-US", {
      style: "currency",
      currency: c || fxD().cur,
      maximumFractionDigits: 0
    }).format(v);
  } catch (e) {
    return Math.round(v).toLocaleString() + " " + (c || fxD().cur);
  }
}
const fxSign = (v, c) => (v > 0 ? "+" : v < 0 ? "−" : "") + fxMoney(Math.abs(v), c);
// The whole account now, in $ (like the top card: account + open trades + long-term).
function fxVal() {
  const q = S.trades.map(fl).filter(x => x != null),
    f = q.reduce((a, b) => a + b, 0),
    L = ltD().h.length ? ltTot() : null;
  return acct() + f + (L ? L.pl : 0);
}
// Net deposits $ (deposits minus withdrawals).
const fxNet = () => fxD().d.reduce((s, r) => s + fxSg(r), 0);
// "Account size from my deposits": the starting size follows the net deposits.
function fxSyncAcct() {
  const F = fxD();
  if (F.sync && F.d.length) S.set.pf = Math.max(0, Math.round(fxNet() * 100) / 100);
}

// The split. Null parts until every rate is known.
function fxCalc() {
  const F = fxD(),
    R = fxNow(),
    rows = F.d;
  if (!rows.length || R == null || rows.some(r => !(r.r > 0) || r.c !== F.cur)) return null;
  const V = fxVal(),
    D = fxNet(),
    DH = rows.reduce((s, r) => s + fxSg(r) * r.r, 0),
    dep = rows.filter(r => r.k !== "w"),
    da = dep.reduce((s, r) => s + r.a, 0),
    avg = da ? dep.reduce((s, r) => s + r.a * r.r, 0) / da : null,
    st = (V - D) * R,
    cu = D * R - DH;
  return { V, D, DH, R, avg, st, cu, tot: V * R - DH };
}

// Load missing rates: today's rate (every 6 hours) and each row's day (once, kept).
async function fxLoad() {
  if (fxBusy) return;
  const F = fxD(),
    c = F.cur;
  if (c === "USD") {
    let ch = false;
    F.d.forEach(r => {
      if (r.r !== 1 || r.c !== "USD") ((r.r = 1), (r.c = "USD"), (r.m = false), (ch = true));
    });
    if (ch) (save(), fxRedraw());
    return;
  }
  if (!F.d.length && tab !== "pf") return;
  // After a failed try, wait a minute before trying again.
  if (fxErr && Date.now() - fxErrT < 6e4) return;
  // Nothing missing: stop here (view() calls this every time it draws).
  const old = FXR[c + "|now"],
    miss = F.d.some(r => !r.m && (!(r.r > 0) || r.c !== c));
  if (old && Date.now() - old[1] <= 6 * 36e5 && !miss) return;
  fxBusy = true;
  const e0 = fxErr;
  fxErr = "";
  let ch = false;
  try {
    const n = FXR[c + "|now"];
    if (!n || Date.now() - n[1] > 6 * 36e5) {
      const j = await (await fetch(FXAPI + "latest?base=USD&symbols=" + c)).json();
      if (j && j.rates && j.rates[c] > 0) {
        FXR[c + "|now"] = [j.rates[c], Date.now(), j.date];
        ch = true;
      }
    }
    const need = [
      ...new Set(F.d.filter(r => !r.m && (!(r.r > 0) || r.c !== c)).map(r => r.d))
    ].slice(0, 25);
    for (const d of need) {
      let v = FXR[c + "|" + d];
      if (!v) {
        const j = await (await fetch(FXAPI + d + "?base=USD&symbols=" + c)).json();
        v = j && j.rates && j.rates[c];
        if (v > 0) FXR[c + "|" + d] = v;
      }
      if (v > 0)
        F.d.forEach(r => {
          if (r.d === d && !r.m) ((r.r = v), (r.c = c), (ch = true));
        });
    }
  } catch (e) {
    fxErr = "Could not load the exchange rate. Type the rate yourself, or try again later.";
    fxErrT = Date.now();
  } finally {
    fxBusy = false;
  }
  if (ch) {
    fxKeep();
    save();
  }
  // Redraw only when something new came in (or the error changed), never in a loop.
  if (ch || fxErr !== e0) fxRedraw();
}
// Redraw what shows the numbers.
function fxRedraw() {
  if (tab === "pf" || tab === "dash") view();
}

// The Dashboard card: where the result came from.
function fxDash() {
  const F = fxD();
  if (!F.d.length) return "";
  const x = fxCalc(),
    c = F.cur;
  if (!x)
    return `<div class="card fxd"><h2>Stocks or currency?</h2><p class="mut">${fxErr || "Loading exchange rates…"}</p></div>`;
  const cl = v => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  return `<div class="card fxd"><p class="hk" aria-hidden="true">where it came from —</p><h2>Stocks or currency?</h2>
<p class="mut" data-nt>${esc(tr("In") + " " + c + tr(", from your deposits until today."))}</p>
<div class="fxs"><div><small>From the stocks</small><b class="${cl(x.st)}" data-nt>${fxSign(x.st)}</b></div><span class="fxop" aria-hidden="true">+</span><div><small>From the currency</small><b class="${cl(x.cu)}" data-nt>${fxSign(x.cu)}</b></div><span class="fxop" aria-hidden="true">=</span><div class="fxt"><small data-nt>${esc(tr("Total in") + " " + c)}</small><b class="${cl(x.tot)}" data-nt>${fxSign(x.tot)}</b></div></div>
<p class="fxk"><span><small>Account value</small> <b data-nt>${$f(x.V, 0)}</b></span><span><small>Net deposits</small> <b data-nt>${$f(x.D, 0)}</b></span><span><small>Average deposit rate</small> <b data-nt>${x.avg == null ? "–" : x.avg.toFixed(3)}</b></span><span><small>Rate today</small> <b data-nt>${x.R.toFixed(3)}</b></span></p></div>`;
}

// The Portfolio tab card: the rows, the form, the settings.
function fxPage() {
  const F = fxD(),
    c = F.cur,
    R = fxNow(),
    td = dkey(new Date());
  const rows = F.d
    .slice()
    .sort((a, b) => (a.d < b.d ? 1 : -1))
    .map(
      r =>
        `<tr><td data-nt>${esc(r.d)}</td><td>${r.k === "w" ? "Withdrawal" : "Deposit"}</td><td data-nt>${$f(r.a, 0)}</td><td class="fxri"><input type="number" step="any" min="0" inputmode="decimal" data-fx="r" data-id="${r.id}" value="${r.r > 0 && r.c === c ? +r.r.toFixed(4) : ""}" placeholder="${fxBusy ? "…" : "Auto"}" aria-label="${esc(tr("Exchange rate") + " " + r.d)}">${r.m ? `<button type="button" class="gh sm" data-fx="auto" data-id="${r.id}" title="${esc(tr("Use the rate of that day"))}" aria-label="${esc(tr("Use the rate of that day"))}">↺</button>` : `<small class="mut">auto</small>`}</td><td data-nt>${r.r > 0 && r.c === c ? fxMoney(fxSg(r) * r.r) : "…"}</td><td><button type="button" class="ib" data-fx="del" data-id="${r.id}" aria-label="${esc(tr("Delete") + " " + r.d)}">×</button></td></tr>`
    )
    .join("");
  return `<div class="card fxp" id="fxp"><p class="hk" aria-hidden="true">money in, money out —</p><h2>Deposits, withdrawals and currency</h2>
<p class="mut">Write each time you moved money into or out of your trading account. Don't remember the rate? Leave it empty and we fill in the rate of that day.</p>
<div class="f fxset"><label>Home currency<select data-fx="cur">${FXC.map(x => `<option${x === c ? " selected" : ""}>${x}</option>`).join("")}</select></label><label class="chk"><input type="checkbox" data-fx="sync"${F.sync ? " checked" : ""}> <span>Account size from my deposits</span></label>${R != null ? `<p class="fxnow"><span>Rate today</span> <b data-nt>1 USD = ${R.toFixed(3)} ${c}</b></p>` : ""}</div>
<form class="f fxf" id="fxf" novalidate><label>Date<input type="date" name="d" value="${td}" max="${td}" required></label><label>Type<select name="k"><option value="d">Deposit</option><option value="w">Withdrawal</option></select></label><label>Amount ($)<input type="number" name="a" step="any" min="0" inputmode="decimal" required placeholder="20000"></label><label>Rate (optional)<input type="number" name="r" step="any" min="0" inputmode="decimal" placeholder="Auto"></label><button type="submit">Add</button></form>
${fxErr ? `<p class="neg fxer">${fxErr}</p>` : ""}
${F.d.length ? `<div class="wrap fxw"><table class="fxt2"><thead><tr><th>Date</th><th>Type</th><th>Amount ($)</th><th>Rate</th><th data-nt>${esc(tr("In") + " " + c)}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${fxDash()}` : `<p class="mut fxe">No deposits yet. Add your first one above.</p>`}</div>`;
}

const fxId = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// Add a row.
document.addEventListener("submit", e => {
  if (e.target.id !== "fxf") return;
  e.preventDefault();
  const f = e.target,
    d = f.elements.d.value,
    a = num(f.elements.a.value),
    r = num(f.elements.r.value),
    F = fxD();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > dkey(new Date()))
    return alert(tr("Please choose a date (not in the future)."));
  if (!(a > 0)) return alert(tr("Please enter an amount above 0."));
  if (F.d.length >= 500) return alert(tr("You reached 500 rows."));
  F.d.push({
    id: fxId(),
    d,
    k: f.elements.k.value === "w" ? "w" : "d",
    a,
    r: r > 0 ? r : null,
    m: r > 0,
    c: F.cur
  });
  fxSyncAcct();
  save();
  view();
  fxLoad();
  const n = document.querySelector("#fxf [name=a]");
  if (n) n.focus();
});
// Change the rate, the home currency, the sync.
document.addEventListener("change", e => {
  const el = e.target.closest && e.target.closest("[data-fx]");
  if (!el) return;
  const F = fxD(),
    k = el.dataset.fx;
  if (k === "cur") {
    if (!FXC.includes(el.value)) return;
    if (
      F.d.some(r => r.m) &&
      !cf(
        "Changing the home currency replaces the rates you typed with the rates of each day. Continue?"
      )
    ) {
      el.value = F.cur;
      return;
    }
    F.cur = el.value;
    F.d.forEach(r => ((r.m = false), (r.r = null)));
    fxErr = "";
  } else if (k === "sync") {
    F.sync = el.checked;
    fxSyncAcct();
  } else if (k === "r") {
    const r = F.d.find(x => x.id === el.dataset.id),
      v = num(el.value);
    if (!r) return;
    if (v > 0) ((r.r = v), (r.m = true), (r.c = F.cur));
    else ((r.m = false), (r.r = null));
  } else return;
  save();
  view();
  fxLoad();
});
// Delete a row, or go back to the rate of that day.
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("button[data-fx]");
  if (!el) return;
  const F = fxD(),
    k = el.dataset.fx,
    i = F.d.findIndex(x => x.id === el.dataset.id);
  if (i < 0) return;
  if (k === "del") {
    if (!cf("Delete this row?")) return;
    F.d.splice(i, 1);
    fxSyncAcct();
  } else if (k === "auto") ((F.d[i].m = false), (F.d[i].r = null));
  else return;
  save();
  view();
  fxLoad();
});
// Keep today's rate fresh while the Portfolio or the Dashboard is open.
setInterval(() => {
  if (S.fx && S.fx.d.length && (tab === "pf" || tab === "dash")) fxLoad();
}, 6e4);
