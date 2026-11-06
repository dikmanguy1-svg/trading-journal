/*
 * 18-profiles-dashboard-rules.js — part of the Trading.Journal app script.
 *
 * Profiles, dashboard blocks and personal rules.
 * - PROF: which tabs and dashboard blocks each profile (day / swing / long-term) gets.
 * - navTabs(): the tab bar for the chosen profiles.
 * - dbToday / dbAlloc / dbSwing / dbInv: dashboard blocks per profile.
 * - Rules ("price of indiscipline"): rulesCard() on the Strategy tab, rkUI() on each
 *   trade (kept the rules or not), rulesDash() shows how much breaking rules cost.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

/* ---- Profiles: one config decides which tabs are main, their order, and the dashboard blocks. Nothing is deleted when the profile changes. ---- */
// Profile names.
const PRN = { day: "Day trader", swing: "Swing trader", lt: "Long-term investor" };
// Tabs and dashboard blocks per profile.
const PROF = {
  day: {
    main: ["str", "pulse", "scr", "calc", "jr", "dash"],
    dash: ["today", "kpi", "rules", "chart", "lt"]
  },
  swing: {
    main: ["str", "pulse", "scr", "calc", "jr", "dash", "mon", "wl"],
    dash: ["kpi", "swing", "chart", "rules", "lt"]
  },
  lt: { main: ["pf", "dash", "wl", "str"], dash: ["inv", "lt", "alloc", "trade"] }
};
// "More" tabs open.
let NAVM = false;
// All tabs including Portfolio.
const TALL = () => [...T, ["pf", "Portfolio"]];
// Main and "more" tabs for the chosen profiles.
function navTabs() {
  const P = (S.prof || []).filter(p => PROF[p]);
  if (!P.length) return { main: T, more: [] };
  const ids = [];
  P.forEach(p =>
    PROF[p].main.forEach(id => {
      if (!ids.includes(id)) ids.push(id);
    })
  );
  const all = TALL(),
    lab = t => [t[0], t[1].replace(/^\d+\.\s*/, "")];
  return {
    main: ids
      .map(id => all.find(t => t[0] === id))
      .filter(Boolean)
      .map(lab),
    more: all.filter(t => !ids.includes(t[0])).map(lab)
  };
}
// Dashboard blocks and their order for the chosen profiles.
function dashOrder() {
  const P = (S.prof || []).filter(p => PROF[p]);
  if (!P.length) return ["prog", "kpi", "rules", "lt", "chart"];
  const o = [];
  P.forEach(p =>
    PROF[p].dash.forEach(k => {
      if (!o.includes(k)) o.push(k);
    })
  );
  const trader = P.some(p => p !== "lt");
  return (trader ? o.filter(k => k !== "trade") : o).concat(["prog"]);
}
// Dashboard: today's trades (day traders).
function dbToday() {
  const d = dkey(new Date()),
    cl = S.trades.filter(t => t.x != null && (t.xd || t.d) === d),
    p = cl.reduce((a, t) => a + (pnl(t) || 0), 0),
    opn = S.trades.filter(t => t.d === d).length,
    q = S.trades.map(fl).filter(x => x != null),
    fo = q.reduce((a, b) => a + b, 0),
    sk = typeof streak === "function" ? streak() : 0;
  return `<div class="card dbt"><h2>Today</h2><div class="kp"><div class="k"><small>Today's P&L (closed)</small><b class="${p > 0 ? "pos" : p < 0 ? "neg" : ""}">${cl.length ? (p > 0 ? "+" : "") + $f(p, 0) : "–"}</b></div><div class="k"><small>Trades entered today</small><b>${opn}</b></div><div class="k"><small>Open P&L now</small><b class="${fo > 0 ? "pos" : fo < 0 ? "neg" : ""}">${q.length ? (fo > 0 ? "+" : "") + $f(fo, 0) : "–"}</b></div><div class="k"><small>Discipline streak (Daily pulse)</small><b>${sk}</b></div></div></div>`;
}
// Dashboard: allocation of holdings.
function dbAlloc() {
  const L = ltD();
  if (!L.h.length)
    return `<div class="card"><h2>Holdings</h2><p class="mut">No holdings yet.</p><p><button class="gh sm" data-t="pf">Add a holding</button></p></div>`;
  const T0 = ltTot();
  return `<div class="card dba"><h2>Holdings</h2>${L.h
    .map(h => {
      const s = ltH(h),
        w = s.val != null && T0.val > 0 ? (s.val / T0.val) * 100 : 0;
      return `<div class="dbar"><span>${ltNm(h)}</span><span class="ltn">${s.val != null ? $f(s.val, 0) : "–"} · ${Math.round(w)}%</span><i style="width:${w.toFixed(1)}%"></i></div>`;
    })
    .join("")}</div>`;
}
// Dashboard: holding time and swing stats.
function dbSwing() {
  const cl = S.trades.filter(t => t.x != null),
    hd = cl
      .filter(t => t.xd && t.d && t.xd >= t.d)
      .map(t => (new Date(t.xd) - new Date(t.d)) / 864e5),
    avg = hd.length ? hd.reduce((a, b) => a + b, 0) / hd.length : null,
    m = {};
  cl.forEach(t => {
    const k = (t.xd || t.d).slice(0, 7);
    m[k] = (m[k] || 0) + (pnl(t) || 0);
  });
  const M = Object.entries(m).sort((a, b) => b[1] - a[1]),
    b = M[0],
    w = M[M.length - 1],
    ml = k =>
      new Date(k + "-15").toLocaleDateString(LANG === "he" ? "he-IL" : "en-US", {
        month: "short",
        year: "numeric"
      }),
    k3 = (t, v, c, sub) =>
      `<div class="k"><small>${t}</small><b class="${c}">${v}</b>${sub ? `<small class="mut" data-nt>${sub}</small>` : ""}</div>`;
  return `<div class="card dbs"><h2>Swing stats</h2><div class="kp">${k3("Average holding time", avg != null ? `<span class="ltn">${avg.toFixed(1)}</span> <span>days</span>` : "–", "")}${k3("Best month", b ? (b[1] > 0 ? "+" : "") + $f(b[1], 0) : "–", b && b[1] > 0 ? "pos" : b && b[1] < 0 ? "neg" : "", b ? ml(b[0]) : "")}${k3("Worst month", M.length > 1 ? (w[1] > 0 ? "+" : "") + $f(w[1], 0) : "–", M.length > 1 && w[1] < 0 ? "neg" : M.length > 1 && w[1] > 0 ? "pos" : "", M.length > 1 ? ml(w[0]) : "")}</div><p class="mut sm">Holding time counts closed trades that have an exit date.</p></div>`;
}
// Dashboard: investor summary.
function dbInv() {
  const L = ltD();
  if (!L.h.length)
    return `<div class="card dbi"><h2>Investor stats</h2><p class="mut">Add your first holding to see your return on what you deposited.</p><p><button class="gh sm" data-t="pf">Add a holding</button></p></div>`;
  const T = ltTot(),
    r = T.inv > 0 ? (T.pl / T.inv) * 100 : null,
    now = new Date(),
    d90 = new Date(now - 90 * 864e5),
    k90 = dkey(d90),
    y = String(now.getFullYear());
  let s90 = 0,
    sy = 0,
    n90 = 0;
  L.h.forEach(h =>
    h.dp.forEach(d => {
      if (!d.d || !(d.a > 0)) return;
      if (d.d >= k90) {
        s90 += d.a;
        n90++;
      }
      if (d.d.slice(0, 4) === y) sy += d.a;
    })
  );
  return `<div class="card dbi"><h2>Investor stats</h2><div class="kp"><div class="k"><small>Return on what you deposited</small><b class="${ltCls(r)}"><span class="ltn">${r != null ? (r > 0 ? "+" : "") + r.toFixed(1) + "%" : "–"}</span></b></div><div class="k"><small>Deposited in the last 90 days</small><b><span class="ltn">${$f(s90, 0)}</span></b><small class="mut"><span class="ltn">${n90}</span> <span>deposits</span></small></div><div class="k"><small>Deposited this year</small><b><span class="ltn">${$f(sy, 0)}</span></b></div></div></div>`;
}
/* ---- My rules + "cost of indiscipline" ---- */
// Most personal rules allowed.
const RMAX = 10;
// Suggested rules per profile.
const RSUG = {
  day: [
    "No trades in the first 15 minutes after the open",
    "I stop trading for the day after 3 losing trades",
    "I always set a stop before I enter",
    "I close all my positions before the market closes"
  ],
  swing: [
    "I always set a stop before I enter",
    "No new positions right before an earnings report",
    "I risk at most 1% of my account on one trade",
    "I only buy stocks above their 50-day moving average"
  ],
  lt: [
    "I deposit on schedule, whatever the market does",
    "I don't sell because of scary news",
    "I check my portfolio once a month, not every day",
    "I keep my portfolio within the split I planned"
  ]
};
// Suggested rules for the chosen profiles.
const rSug = () => {
  const P = (S.prof || []).filter(p => RSUG[p]),
    have = new Set((S.rules || []).map(r => r.t));
  return [...new Set((P.length ? P : ["swing"]).flatMap(p => RSUG[p]))]
    .filter(x => !have.has(tr(x)))
    .slice(0, 6);
};
// "My rules" card on the Strategy tab.
function rulesCard() {
  const R = S.rules || [];
  return `<div class="card" id="rules"><h2>My rules</h2><p class="mut">Write the trading rules you want to keep, in your own words. In the Trade journal you can then mark, for every trade, whether you followed them.</p>
${R.length ? `<ol class="rl">${R.map((r, i) => `<li><input data-k="rt" data-i="${i}" maxlength="200" value="${esc(r.t)}" aria-label="Rule ${i + 1}"><button class="gh sm" data-a="rdl" data-id="${i}" aria-label="Delete rule ${i + 1}">Delete</button></li>`).join("")}</ol>` : `<p class="mut">No rules yet. For example: “I always set a stop before I enter.”</p>`}
${R.length < RMAX ? `<div class="rla"><label class="vh" for="rn">New rule</label><input id="rn" maxlength="200" placeholder="New rule, for example: No trades in the first 15 minutes"><button class="gh" data-a="ra">Add rule</button></div>` : ""}${
    R.length < RMAX && rSug().length
      ? `<div class="rsg"><p class="mut sm" style="text-align:start;margin:10px 0 6px">Suggestions for you. Tap to add:</p><div class="chips">${rSug()
          .map(
            x =>
              `<button class="chip sm" data-a="rsg" data-v="${esc(x)}"><span aria-hidden="true">+ </span><span>${esc(x)}</span></button>`
          )
          .join("")}</div></div>`
      : ""
  }<p class="mut sm" style="text-align:start"><span>${R.length}</span> / ${RMAX}</p></div>`;
}
// Kept-the-rules buttons on a trade.
function rkUI(t) {
  const R = S.rules || [],
    ids = new Set(R.map(r => r.id)),
    gone = (t.rb || []).filter(id => !ids.has(id)).length;
  return `<div class="rk"><select data-k="trk" data-id="${t.id}" aria-label="Followed my rules? ${esc(t.t)}"><option value=""${!t.rk ? " selected" : ""}>Not marked</option><option value="y"${t.rk === "y" ? " selected" : ""}>Followed my rules</option><option value="n"${t.rk === "n" ? " selected" : ""}>Broke a rule</option></select>${
    t.rk === "n"
      ? R.length
        ? `<div class="rkb" role="group" aria-label="Which rule did I break?">${R.map(r => {
            const on = (t.rb || []).includes(r.id);
            return `<button class="chip sm${on ? " on" : ""}" data-a="trb" data-id="${t.id}" data-r="${r.id}" aria-pressed="${on}" title="${esc(r.t)}">${esc(r.t.length > 34 ? r.t.slice(0, 33) + "…" : r.t)}</button>`;
          }).join(
            ""
          )}${gone ? `<span class="mut sm">${gone} <span>deleted rule</span></span>` : ""}</div>`
        : `<p class="mut sm" style="margin:4px 0 0;text-align:start"><button class="gh sm" data-t="str">Add your rules</button></p>`
      : ""
  }</div>`;
}
// "Price of indiscipline": what breaking the rules cost.
function rulesDash() {
  const cl = S.trades.filter(t => t.x != null),
    g = k => cl.filter(t => (t.rk || "") === k),
    Y = g("y"),
    N = g("n"),
    M = g(""),
    sum = a => a.reduce((x, t) => x + (pnl(t) || 0), 0);
  if (!(S.rules || []).length && !Y.length && !N.length)
    return `<div class="card rdash"><h2>Cost of indiscipline</h2><p class="mut">Write your trading rules, then mark each trade as followed or broken. This card will show how the two groups of your closed trades compare.</p><p><button class="gh sm" data-t="str">Write my rules</button></p></div>`;
  const cnt = {};
  N.forEach(t => (t.rb || []).forEach(id => (cnt[id] = (cnt[id] || 0) + 1)));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0],
    tr = top && (S.rules || []).find(r => r.id === top[0]);
  const tile = (lab, a) => {
    const v = sum(a);
    return `<div class="k"><small>${lab}</small><b class="${a.length ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : ""}">${a.length ? (v > 0 ? "+" : "") + $f(v, 0) : "–"}</b><span class="mut sm rdn"><span>${a.length}</span> <span>${a.length === 1 ? "closed trade" : "closed trades"}</span></span></div>`;
  };
  return `<div class="card rdash"><h2>Cost of indiscipline</h2><p class="mut">Your closed trades, split by how you marked them in the journal. This describes your past trades only. It is not a forecast or investment advice.</p><div class="kp">${tile("Followed my rules", Y)}${tile("Broke a rule", N)}</div>
 <p class="mut sm" style="text-align:start;margin-top:10px"><span>Not marked</span>: <span>${M.length}</span> <span>${M.length === 1 ? "closed trade" : "closed trades"}</span>${tr ? `. <span>Most often broken</span>: “${esc(tr.t)}” (<span>${top[1]}</span>)` : ""}</p></div>`;
}
