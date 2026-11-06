/*
 * 18b-tab-hero.js — part of the Trading.Journal app script.
 *
 * The top of the page (headline, line under it, button, small live fact) changes with the open tab.
 * - TABH: the texts per tab. The Dashboard keeps the profile headline (HERO in 06-views-events.js).
 * - heroFact(): one short live fact for the tab (for example "Today: 3 of 6 answered").
 * - heroTab(): called by heroSet(); returns true when it drew a tab headline.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Texts per tab: [line 1, line 2, line under the headline, button tab, button text].
const TABH = {
  str: [
    "Your plan.",
    "Your rules.",
    "Pick your profile, your tools and the rules you trade by. The site builds your checks from them.",
    "pulse",
    "Start today's check"
  ],
  pulse: [
    "Check yourself",
    "before you click.",
    "One minute before the market opens. If one answer is No, today is not a trading day.",
    "scr",
    "Screen a stock"
  ],
  scr: [
    "Only the best",
    "setups pass.",
    "Every answer must be Yes. If one is No, wait for a better setup.",
    "calc",
    "Size the trade"
  ],
  calc: [
    "Size it",
    "before you buy it.",
    "Your stop decides how many shares. Never risk more than your rule.",
    "jr",
    "Log the trade"
  ],
  jr: [
    "Write it down.",
    "Own the trade.",
    "Every trade with its reason. Close it with an honest note.",
    "dash",
    "See my dashboard"
  ],
  mon: [
    "Your month,",
    "honestly.",
    "Wins, losses and lessons, month by month.",
    "dash",
    "See my dashboard"
  ],
  wl: [
    "Wait for",
    "your price.",
    "Plan the entry, the stop and the target before the move. The signal tells you when.",
    "scr",
    "Screen a stock"
  ],
  pf: [
    "Invest with a plan.",
    "Stay with it.",
    "Deposit on schedule and let time do the work.",
    "dash",
    "See my dashboard"
  ]
};
// Investors only (long-term profile): calmer texts for the two check tabs.
const TABH_LT = {
  pulse: [
    "Check in",
    "before you invest.",
    "A short check before every deposit or new purchase.",
    "scr",
    "Check a stock or fund"
  ],
  scr: [
    "Buy what",
    "you understand.",
    "Every answer should be Yes before it goes into your portfolio.",
    "pf",
    "Open my portfolio"
  ]
};

// One short live fact for the open tab, or "" when there is nothing to say.
function heroFact(t) {
  const cnt = (a, v) => (a || []).filter(x => x === v).length;
  if (t === "pulse") {
    const n = QP().length,
      a = (S.pulse || []).filter(x => x === "Yes" || x === "No").length;
    return `<span>Today</span>: <span class="ltn">${a}</span> <span>of</span> <span class="ltn">${n}</span> <span>answered</span>`;
  }
  if (t === "scr") {
    const n = QS().length,
      y = cnt(S.scr && S.scr.a, "Yes");
    return S.scr && S.scr.t
      ? `<span data-nt>${esc(S.scr.t)}</span>: <span class="ltn">${y}</span> <span>of</span> <span class="ltn">${n}</span> <span>Yes</span>`
      : `<span class="ltn">${n}</span> <span>questions</span>`;
  }
  if (t === "calc") {
    const r = (S.set && S.set.mr) || 0;
    return `<span>Max risk per trade</span>: <span class="ltn">${(r * 100).toFixed((r * 100) % 1 ? 1 : 0)}%</span> · <span class="ltn">${$f(acct() * r, 0)}</span>`;
  }
  if (t === "jr") {
    const o = S.trades.filter(x => x.x == null).length;
    return `<span class="ltn">${o}</span> <span>open trades</span> · <span class="ltn">${S.trades.length - o}</span> <span>closed</span>`;
  }
  if (t === "mon") {
    const m = dkey(new Date()).slice(0, 7),
      p = S.trades
        .filter(x => x.x != null && (x.xd || x.d).slice(0, 7) === m)
        .reduce((a, x) => a + (pnl(x) || 0), 0);
    return `<span>This month</span>: <span class="ltn ${p > 0 ? "pos" : p < 0 ? "neg" : ""}">${(p > 0 ? "+" : "") + $f(p, 0)}</span>`;
  }
  if (t === "wl") {
    const hit = S.wl.filter(w => {
      const e = num(w.e),
        s = num(w.s),
        p = wp(w),
        L = w.dir !== "Short";
      return e && p && !(s && (L ? p <= s : p >= s)) && (L ? p >= e : p <= e);
    }).length;
    return `<span class="ltn">${S.wl.length}</span> <span>on the list</span> · <span class="ltn">${hit}</span> <span>at the trigger</span>`;
  }
  if (t === "pf") {
    const L = ltD();
    if (!L.h.length) return `<span>No holdings yet.</span>`;
    const T0 = ltTot();
    return `<span class="ltn">${L.h.length}</span> <span>holdings</span> · <span class="ltn">${$f(T0.val, 0)}</span>`;
  }
  if (t === "str") {
    const r = (S.rules || []).length,
      k = ((S.st && S.st.tools) || []).length + ((S.st && S.st.custom) || []).length;
    return `<span class="ltn">${r}</span> <span>rules</span> · <span class="ltn">${k}</span> <span>tools picked</span>`;
  }
  return "";
}

// Draw the headline for the open tab. Returns false on the Dashboard (the profile headline is used there).
function heroTab() {
  const H = (ltOnly() && TABH_LT[tab]) || TABH[tab];
  const f = $("hst");
  if (!H || !$("hh1")) {
    if (f) {
      f.innerHTML = "";
      f.hidden = true;
    }
    return false;
  }
  const fact = heroFact(tab),
    k = "tab|" + tab + "|" + (ltOnly() ? 1 : 0) + "|" + LANG + "|" + fact;
  if (k === heroK) return true;
  heroK = k;
  $("hh1").innerHTML = `<span>${H[0]}</span><br><span>${H[1]}</span>`;
  $("hsb").textContent = H[2];
  const c = $("hcta");
  c.dataset.t = H[3];
  c.textContent = H[4];
  if (f) {
    f.innerHTML = fact;
    f.hidden = !fact;
  }
  return true;
}

// ---- The small card next to the headline also changes with the tab ----

// The original candle card (kept for the Dashboard).
let HQ0 = null;
// Which card is shown now (redraw only when it changes).
let hqK = null;
// Shorten a text to n characters.
const hqCut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
// A row: label on one side, value on the other.
const hqRow = (a, b, cls) =>
  `<div class="hqr"><span>${a}</span><b class="${cls || ""}" data-nt>${b}</b></div>`;
// A progress bar from 0 to 1.
const hqBar = f =>
  `<div class="hqb"><i style="width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%"></i></div>`;
// A Yes / No / not answered mark.
const hqMark = v =>
  v === "Yes"
    ? `<i class="hqm y" aria-label="Yes">✓</i>`
    : v === "No"
      ? `<i class="hqm n" aria-label="No">✕</i>`
      : `<i class="hqm" aria-label="Not answered">○</i>`;
// Money with a + sign and a color class.
const hqPl = v => [(v > 0 ? "+" : "") + $f(v, 0), v > 0 ? "pos" : v < 0 ? "neg" : ""];

// The card body for a tab: [title, body HTML, closing line]. null = keep the candle card.
function hqBody(t) {
  if (t === "str") {
    const R = S.rules || [];
    return [
      "Your rules",
      R.length
        ? `<ol class="hql">${R.slice(0, 4)
            .map(r => `<li data-nt>${esc(hqCut(r.t, 46))}</li>`)
            .join("")}</ol>${R.length > 4 ? `<div class="mut hqs">+${R.length - 4}</div>` : ""}`
        : `<div class="mut hqe">No rules yet. Write the first one below.</div>`,
      "Rules you keep beat rules you know."
    ];
  }
  if (t === "pulse" || t === "scr") {
    const Q = t === "pulse" ? QP() : QS(),
      A = t === "pulse" ? S.pulse || [] : (S.scr && S.scr.a) || [],
      a = A.filter(x => x === "Yes" || x === "No").length,
      y = A.filter(x => x === "Yes").length;
    const head =
      t === "pulse" ? "Today's check" : S.scr && S.scr.t ? esc(S.scr.t) : "Next candidate";
    return [
      head,
      `<div class="hqbig"><b data-nt>${t === "pulse" ? a : y}/${Q.length}</b> <span>${t === "pulse" ? "answered" : "Yes"}</span></div>${hqBar((t === "pulse" ? a : y) / (Q.length || 1))}<div class="hqq">${Q.slice(
        0,
        4
      )
        .map((q, i) => `<div>${hqMark(A[i])}<span>${hqCut(tr(q), 44)}</span></div>`)
        .join("")}</div>`,
      t === "pulse" ? "A No today saves money tomorrow." : "Every answer Yes, or wait."
    ];
  }
  if (t === "calc") {
    const r = calc();
    if (!r)
      return [
        "Position size",
        `<div class="mut hqe">Fill in entry, stop and target below.</div>`,
        "The stop decides the size."
      ];
    return [
      "Position size",
      hqRow(tr("Entry"), $f(r.e, 2)) +
        hqRow(tr("Stop"), $f(r.s, 2)) +
        hqRow(tr("Shares"), String(r.sh)) +
        hqRow(tr("Risk $"), $f(r.rk, 0), r.rk > acct() * S.set.mr ? "neg" : "") +
        hqRow("R:R", r.R.toFixed(1), r.R >= S.set.rr ? "pos" : "neg"),
      "The stop decides the size."
    ];
  }
  if (t === "jr") {
    const L = [...S.trades].sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 4);
    if (!L.length)
      return [
        "Latest trades",
        `<div class="mut hqe">No trades yet.</div>`,
        "Every trade is a lesson if you write it down."
      ];
    return [
      "Latest trades",
      L.map(x => {
        const p = x.x != null ? pnl(x) : fl(x),
          [v, c] = p == null ? ["open", ""] : hqPl(p);
        return hqRow(
          `<b data-nt>${esc(x.t)}</b> <span class="mut">${x.x == null ? tr("open") : x.dir === "Short" ? tr("Short") : tr("Long")}</span>`,
          v,
          c
        );
      }).join(""),
      "Every trade is a lesson if you write it down."
    ];
  }
  if (t === "mon") {
    const now = new Date(),
      M = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 15),
        k = dkey(d).slice(0, 7);
      M.push([
        k,
        S.trades
          .filter(x => x.x != null && (x.xd || x.d).slice(0, 7) === k)
          .reduce((a, x) => a + (pnl(x) || 0), 0)
      ]);
    }
    const mx = Math.max(1, ...M.map(m => Math.abs(m[1]))),
      ml = k =>
        new Date(k + "-15").toLocaleDateString(LANG === "he" ? "he-IL" : "en-US", {
          month: "short"
        });
    return [
      "Last 6 months",
      `<div class="hqm6" aria-hidden="true">${M.map(([k, v]) => `<div><span class="${v >= 0 ? "pos" : "neg"}" style="height:${Math.max(3, Math.round((Math.abs(v) / mx) * 70))}px"></span><small data-nt>${ml(k)}</small></div>`).join("")}</div>` +
        hqRow(tr("This month"), hqPl(M[5][1])[0], hqPl(M[5][1])[1]),
      "One month is noise. Six show the truth."
    ];
  }
  if (t === "wl") {
    const W = S.wl.slice(0, 4);
    if (!W.length)
      return [
        "On the watchlist",
        `<div class="mut hqe">Nothing on the list yet.</div>`,
        "The best trades wait for you."
      ];
    return [
      "On the watchlist",
      W.map(w => {
        const e = num(w.e),
          p = wp(w),
          d = e && p ? ((p - e) / e) * 100 : null;
        return hqRow(
          `<b data-nt>${esc(w.t)}</b> <span class="mut">${tr("to entry")}</span>`,
          d == null ? "–" : (d > 0 ? "+" : "") + d.toFixed(1) + "%"
        );
      }).join(""),
      "The best trades wait for you."
    ];
  }
  if (t === "pf") {
    const L = ltD();
    if (!L.h.length)
      return [
        "Your portfolio",
        `<div class="mut hqe">No holdings yet.</div>`,
        "Time does the heavy lifting."
      ];
    const T0 = ltTot();
    return [
      "Your portfolio",
      L.h
        .slice(0, 4)
        .map(h => {
          const s = ltH(h),
            w = s.val != null && T0.val > 0 ? (s.val / T0.val) * 100 : 0;
          return `<div class="hqa"><span data-nt>${esc(h.t || h.nm || "")}</span><b data-nt>${Math.round(w)}%</b><i style="width:${w.toFixed(1)}%"></i></div>`;
        })
        .join("") + hqRow(tr("Total value"), $f(T0.val, 0)),
      "Time does the heavy lifting."
    ];
  }
  return null;
}

// Draw the card for the open tab (called from heroSet through heroTab and on the Dashboard).
function heroCard() {
  const q = document.querySelector(".hero .hq");
  if (!q) return;
  if (HQ0 == null) HQ0 = q.innerHTML;
  const B = hqBody(tab),
    html = B ? `<div class="hqt">${B[0]}</div>${B[1]}<p>${B[2]}</p>` : HQ0,
    k = tab + "|" + LANG + "|" + html.length + "|" + html.slice(-400);
  if (k === hqK) return;
  hqK = k;
  q.innerHTML = html;
  q.classList.toggle("hqx", !!B);
}
