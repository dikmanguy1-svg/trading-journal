/*
 * 04-questions-state-calc.js — part of the TradeInk app script.
 *
 * Question editor, tab list, saving and trade math.
 * - qblock(): one Yes/No question list with its edit mode.
 * - T: the tabs in order. tab: the open tab.
 * - save(): saves the state (to the account when logged in).
 * - Trade math: pnl, risk, rr (reward/risk), aR, account size, invested, free cash.
 * - calc(): the risk calculator.
 * - csv(): small CSV parser. clean(): checks and repairs ANY loaded data
 *   (from the cloud, this device or a backup file) before it is used. Keep it strict.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Which question list is being edited (null = none).
let edq = null;
// The current pulse / screening questions (the user's own, or the defaults).
const QP = () => (S.qp && S.qp.length ? S.qp : ltOnly() ? LPQ : PQ),
  QS = () => (S.qs && S.qs.length ? S.qs : ltOnly() ? LSQ : SQ);
// The editable copy of a question list.
function qarr(id) {
  if (id === "pulse") {
    if (!S.qp) S.qp = QP().slice();
    return S.qp;
  }
  if (!S.qs) S.qs = QS().slice();
  return S.qs;
}
// Reset the answers after the questions changed.
function fixA(id) {
  if (id === "pulse") S.pulse = Array(QP().length).fill(null);
  else S.scr.a = Array(QS().length).fill(null);
}
// HTML of a Yes/No question list, with its edit mode.
function qblock(key) {
  const P = key === "pulse",
    qs = P ? QP() : QS(),
    arr = P ? S.pulse : S.scr.a;
  if (edq !== key)
    return (
      yn(arr, qs, key) +
      `<p><button class="gh sm" data-a="eq" data-id="${key}">Edit questions</button></p>`
    );
  return (
    qs
      .map(
        (q, i) =>
          `<div class="row"><span class="mut">${i + 1}</span><input data-k="qe" data-id="${key}" data-i="${i}" maxlength="200" value="${esc(q)}" aria-label="Question ${i + 1}"><button class="gh sm" data-a="qd" data-id="${key}" data-i="${i}">Delete</button></div>`
      )
      .join("") +
    `<p><button class="gh sm" data-a="qa" data-id="${key}">Add question</button> <button class="gh sm" data-a="qr" data-id="${key}">Reset to default</button> <button class="gh sm" data-a="qx">Done</button></p>`
  );
}
// UI state: the open tab and a few open/closed panels.
let setOpen = true,
  tab = "str",
  ref = null,
  openN = null,
  tmr = null;
// The tabs, in order.
const T = [
  ["str", "Strategy"],
  ["pulse", "1. Daily pulse"],
  ["scr", "2. Stock screening"],
  ["calc", "3. Risk calculator"],
  ["jr", "4. Trade journal"],
  ["dash", "5. Dashboard"],
  ["mon", "6. Monthly report"],
  ["wl", "7. Watchlist"]
];
// Save the state (to the cloud when logged in).
function save() {
  if (U && cloudReady) return cloudSave();
  if (FB) {
    $("sv").textContent = "Log in to save your journal";
    return;
  }
  try {
    localStorage.setItem("tj_v1", JSON.stringify(S));
    $("sv").textContent = "Saved on this device";
  } catch (e) {
    $("sv").textContent = "Could not save here";
  }
}
// Input value to number (empty = null).
const num = v => (v === "" || v == null ? null : Number(v));
// Profit / loss of a closed trade in $ (null while open).
const pnl = t => (t.x == null ? null : (t.x - t.e) * t.sh * (t.dir === "Short" ? -1 : 1));
// Money at risk: distance to stop x shares.
const risk = t => (t.s == null ? null : Math.abs(t.e - t.s) * t.sh);
// Reward / risk ratio.
const rr = t => (t.s == null || t.tg == null ? null : Math.abs(t.tg - t.e) / Math.abs(t.e - t.s));
// Result in R (P&L divided by the risk).
const aR = t => {
  const p = pnl(t),
    r = risk(t);
  return p == null || !r ? null : p / r;
};
// HTML rows of Yes/No buttons for a question list.
function yn(arr, qs, key) {
  return qs
    .map(
      (q, i) =>
        `<div class="row"><span class="mut">${i + 1}</span><span>${esc(q)}</span><select aria-label="Answer ${i + 1}" data-k="${key}" data-i="${i}"><option value="">Choose</option><option${arr[i] === "Yes" ? " selected" : ""}>Yes</option><option${arr[i] === "No" ? " selected" : ""}>No</option></select></div>`
    )
    .join("");
}
// The pass / stop message under a question list.
function gate(arr, msgOk, msgNo, n) {
  const no = arr.filter(x => x === "No").length,
    a = arr.filter(x => x).length;
  return a < n
    ? `<div class="status wait">Answer all ${n} questions (${a} answered)</div>`
    : no
      ? `<div class="status no">${msgNo} (${no} “No”)</div>`
      : `<div class="status ok">${msgOk}</div>`;
}
// All pulse / screening answers are Yes.
const pulseOK = () => S.pulse.every(x => x === "Yes"),
  scrOK = () => S.scr.a.every(x => x === "Yes");
// Account math: realized P&L, account size, invested, long-term, free cash.
const realz = () => S.trades.reduce((a, t) => a + (t.x != null ? pnl(t) : 0), 0),
  acct = () => S.set.pf + realz(),
  cost = t => t.e * t.sh,
  inv = () => S.trades.reduce((a, t) => a + (t.x == null ? cost(t) : 0), 0),
  ltInvC = () => (S.lt && Array.isArray(S.lt.h) && S.lt.h.length ? ltTot().inv : 0),
  cash = () => acct() - inv() - ltInvC();
// The risk calculator (position size from account, risk and stop).
function calc() {
  const A = acct(),
    c = S.calc,
    e = num(c.e),
    s = num(c.s),
    tg = num(c.tg),
    p = S.set;
  if (!e || !s || !tg) return null;
  const L = c.dir === "Long",
    valid = L ? s < e && tg > e : s > e && tg < e,
    rps = Math.abs(e - s),
    pps = Math.abs(tg - e),
    amt = num(c.amt),
    shn = num(c.shs),
    mode = shn > 0 ? "shares" : amt > 0 ? "amount" : "alloc",
    sh = Math.round(mode === "shares" ? shn : mode === "amount" ? amt / e : (A * p.al) / e),
    cst = sh * e,
    rk = sh * rps,
    R = rps ? pps / rps : 0;
  return {
    mode,
    valid,
    rps,
    pps,
    sh,
    cost: cst,
    pct: cst / A,
    cashAfter: cash() - cst,
    rk,
    rkp: rk / A,
    R,
    prof: sh * pps,
    ok: valid && sh > 0 && R >= p.rr && rk <= A * p.mr,
    e,
    s,
    tg
  };
}
// Live price of a trade's ticker, if loaded.
const lp = t => (S.px && S.px[t.t] != null ? S.px[t.t] : null);
// Price for a watchlist row (live, or the one typed by hand).
const wp = w => (S.px && S.px[w.t] != null ? S.px[w.t] : num(w.p));
// SMA150 for a watchlist row (feature off).
const sm = w => (S.sma && S.sma[w.t] != null ? S.sma[w.t] : num(w.m));
// Is the US market open now (New York time).
const mktOpen = () => {
  try {
    const f = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        hour: "numeric",
        minute: "numeric",
        hour12: false
      }).formatToParts(new Date()),
      g = k => (f.find(p => p.type === k) || {}).value,
      x = (+g("hour") % 24) * 60 + +g("minute");
    return !["Sat", "Sun"].includes(g("weekday")) && x >= 570 && x < 960;
  } catch (e) {
    return false;
  }
};
// Open P&L of an open trade at the live price.
const fl = t => {
  const n = lp(t);
  return t.x != null || n == null ? null : (n - t.e) * t.sh * (t.dir === "Short" ? -1 : 1);
};
// Small CSV parser (quotes supported).
function csv(s) {
  const r = [];
  let a = [],
    f = "",
    q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      a.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      a.push(f);
      r.push(a);
      a = [];
      f = "";
    } else f += c;
  }
  a.push(f);
  r.push(a);
  return r;
}
// Exit reasons.
const RSL = ["Target Hit", "Stop Hit", "BE (Breakeven)", "Manual Exit"];
// Normalize an exit reason typed in any form.
const rsN = v => {
  const k = String(v || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return k.startsWith("target")
    ? RSL[0]
    : k.startsWith("stop")
      ? RSL[1]
      : k.startsWith("be")
        ? RSL[2]
        : k.startsWith("manual")
          ? RSL[3]
          : "";
};
// Signed money text and signed percent text.
const sgn = v => (v > 0 ? "+" : "") + $f(v, 2),
  spc = (v, b) => (b > 0 ? (v > 0 ? "+" : "") + ((v / b) * 100).toFixed(2) + "%" : "–");
// Tooltip text for a chart point.
function tipT(nm, v, b, hi, lo) {
  const he = LANG === "he";
  return (
    nm +
    " | " +
    (he ? "רווח/הפסד: " : "P&L: ") +
    sgn(v) +
    " (" +
    spc(v, b) +
    ")" +
    (hi == null
      ? ""
      : " | " +
        (he ? "שיא בחודש: " : "Best point: ") +
        sgn(hi) +
        (he ? " שפל: " : " Worst point: ") +
        sgn(lo)) +
    (he
      ? " | באחוזים מערך החשבון בתחילת התקופה (" + $f(b, 0) + ")"
      : " | % of account value at start (" + $f(b, 0) + ")")
  );
}
// Chart type: line or candles (saved on this device).
var CT = (() => {
  try {
    const v = localStorage.getItem("tj_chart");
    return v === "c" || v === "m" ? v : "l";
  } catch (e) {
    return "l";
  }
})();
// Check and repair loaded data. Every field is limited to a safe type and size.
function clean(d) {
  d = d && typeof d === "object" ? d : {};
  const n = v => {
      v = parseFloat(v);
      return isFinite(v) ? v : null;
    },
    t = (v, m = 2000) => String(v ?? "").slice(0, m),
    yn = (a, i) => (a && ["Yes", "No"].includes(a[i]) ? a[i] : null),
    dr = v => (v === "Short" ? "Short" : "Long");
  const qa = v => {
      const r = Array.isArray(v)
        ? v
            .slice(0, 30)
            .map(x => t(x, 200))
            .filter(x => x.trim())
        : [];
      return r.length ? r : null;
    },
    q1 = qa(d.qp),
    q2 = qa(d.qs);
  const o = {
    set: {
      pf: n(d.set?.pf) || 10000,
      al: n(d.set?.al) ?? 0.1,
      mr: n(d.set?.mr) ?? 0.01,
      rr: n(d.set?.rr) ?? 2
    },
    qp: q1,
    qs: q2,
    st: {
      type: STP[d.st?.type] ? d.st.type : "",
      style: STY[d.st?.style] ? d.st.style : "",
      tools: Array.isArray(d.st?.tools)
        ? d.st.tools.filter(k => TL[k] || TLX.day[k] || TLX.swing[k]).slice(0, 40)
        : [],
      custom: Array.isArray(d.st?.custom)
        ? d.st.custom
            .map(c => ({ n: t(c?.n, 30).trim(), q: t(c?.q, 200).trim() }))
            .filter(c => c.n && c.q)
            .slice(0, 10)
        : []
    },
    g: Array.isArray(d.g) ? d.g.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(String(x))).slice(-400) : [],
    bd: Array.isArray(d.bd) ? d.bd.map(x => t(x, 20)).slice(0, 30) : null,
    pulse: Array.from({ length: (q1 || PQ).length }, (_, i) => yn(d.pulse, i)),
    scr: {
      t: t(d.scr?.t, 10).toUpperCase(),
      a: Array.from({ length: (q2 || SQ).length }, (_, i) => yn(d.scr?.a, i))
    },
    calc: {
      t: t(d.calc?.t, 10).toUpperCase(),
      dir: dr(d.calc?.dir),
      e: t(n(d.calc?.e) ?? "", 20),
      s: t(n(d.calc?.s) ?? "", 20),
      tg: t(n(d.calc?.tg) ?? "", 20),
      th: t(d.calc?.th, 2000),
      amt: t(n(d.calc?.amt) ?? "", 20),
      shs: t(n(d.calc?.shs) ?? "", 20)
    },
    trades: (Array.isArray(d.trades) ? d.trades : [])
      .slice(0, 5000)
      .map((x, i) => ({
        id: /^[\w-]{1,40}$/.test(x?.id) ? x.id : "t" + Date.now() + i,
        d: /^\d{4}-\d{2}-\d{2}$/.test(x?.d) ? x.d : "1970-01-01",
        t: t(x?.t, 10).toUpperCase(),
        dir: dr(x?.dir),
        e: n(x?.e),
        s: n(x?.s),
        tg: n(x?.tg),
        sh: n(x?.sh),
        x: n(x?.x),
        xd: /^\d{4}-\d{2}-\d{2}$/.test(x?.xd) ? x.xd : "",
        rs: rsN(x?.rs),
        m: n(x?.m),
        th: t(x?.th),
        ls: t(x?.ls),
        xr: t(x?.xr),
        rk: x?.rk === "y" || x?.rk === "n" ? x.rk : "",
        rb: Array.isArray(x?.rb) ? x.rb.filter(v => /^[\w-]{1,40}$/.test(v)).slice(0, 10) : []
      }))
      .filter(x => x.e != null && x.sh != null),
    wl: (Array.isArray(d.wl) ? d.wl : [])
      .slice(0, 2000)
      .map(w => ({
        t: t(w?.t, 10).toUpperCase(),
        dir: dr(w?.dir),
        e: n(w?.e),
        s: n(w?.s),
        tg: n(w?.tg),
        p: n(w?.p),
        m: n(w?.m)
      }))
      .filter(w => w.t),
    prof: Array.isArray(d.prof)
      ? [...new Set(d.prof.filter(p => PRN[p]))]
      : STP[d.st?.type]
        ? [d.st.type]
        : [],
    rules: (Array.isArray(d.rules) ? d.rules : [])
      .slice(0, 10)
      .map((r, i) => ({
        id: /^[\w-]{1,40}$/.test(r?.id) ? r.id : "r" + Date.now() + i,
        t: t(r?.t, 200).trim()
      }))
      .filter(r => r.t),
    lt: ltClean(d.lt),
    px: {},
    pxT: {},
    sma: {},
    smaT: {}
  };
  if (d.px && typeof d.px === "object")
    for (const k of Object.keys(d.px))
      if (/^[A-Z0-9.\-]{1,10}$/.test(k) && n(d.px[k]) != null) o.px[k] = n(d.px[k]);
  for (const [nm, mp] of [
    ["sma", d.sma],
    ["smaT", d.smaT]
  ])
    if (mp && typeof mp === "object")
      for (const k of Object.keys(mp))
        if (/^[A-Z0-9.\-]{1,10}$/.test(k) && n(mp[k]) != null) o[nm][k] = n(mp[k]);
  if (typeof d.key === "string" && /^[\w-]{10,80}$/.test(d.key)) o.key = d.key;
  if (typeof d.td === "string" && /^[\w-]{10,80}$/.test(d.td)) o.td = d.td;
  return o;
}
