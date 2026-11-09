/*
 * 17-landing-plans.js — part of the TradeInk app script.
 *
 * Landing page, part 2.
 * - PLANP: plan prices (USD on the English site, ILS on the Hebrew site).
 * - lsPlans(): the plans section. lsHTML(): the whole landing page.
 * - lsAuto / lsMotion / lsFrame: scroll-driven animation of the landing steps.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Landing page style switches.
const LSW = "w-dark w-italic w-compact";
// Compact landing layout is on.
const LSC0 = () => LSW.includes("w-compact");
/* Plans & pricing on the landing page: display only, no payments. Features that don't exist yet carry a "Soon" tag.
   Prices live only here (PLANP), so they are easy to change later (e.g. VAT on the shekel prices). English shows USD, Hebrew shows ILS. ym = yearly price per month. */
// Plan prices (monthly / yearly; USD and ILS).
const PLANP = {
  USD: { pat: { m: 4.99, y: 44.99 }, dis: { m: 9.99, y: 89.99 }, mas: { m: 14.99, y: 134.99 } },
  ILS: { pat: { m: 15, y: 129 }, dis: { m: 29, y: 259 }, mas: { m: 49, y: 439 } }
};
// HTML of the plans section.
function lsPlans(he) {
  const cur = he ? "ILS" : "USD",
    sym = he ? "₪" : "$",
    fm = v => {
      v = Math.round(v * 100) / 100;
      return sym + (Number.isInteger(v) ? String(v) : v.toFixed(2));
    },
    S1 = `<span class="soon">Soon</span>`,
    pr = PLANP[cur];
  const NM = {
      st: ["Starter", "מתחיל"],
      pat: ["Patient", "סבלני"],
      dis: ["Disciplined", "ממושמע"],
      mas: ["Master", "מאסטר"]
    },
    P = [
      {
        k: "st",
        t: "Start building discipline.",
        f: [
          "Trade journal (up to 10 trades a month)",
          "Risk calculator",
          "Daily pulse and stock screening (up to 10 checks a month, one strategy)",
          "Dashboard for the last 30 days",
          "XP and streaks",
          ["Cost of indiscipline (total only)", 1]
        ]
      },
      {
        k: "pat",
        t: "For investors building wealth slowly.",
        lead: "Everything in Starter, plus:",
        f: [
          "Long-term holdings",
          "Fixed monthly deposit",
          "Compound interest calculator",
          "CSV import"
        ]
      },
      {
        k: "dis",
        t: "For traders who decide before they click.",
        rec: 1,
        lead: "Everything in Starter, plus:",
        f: [
          "Unlimited trades and checks",
          "All trading tools, no limits",
          "Full history",
          "CSV import from your broker",
          ["Full cost of indiscipline breakdown", 1],
          ["Wick, the AI coach", 1]
        ]
      },
      {
        k: "mas",
        t: "Everything, in one place.",
        lead: "Everything in Disciplined and Patient, plus:",
        f: [
          "Unlimited trades and checks",
          "All trading and long-term tools",
          ["Full cost of indiscipline breakdown", 1],
          ["More messages to Wick", 1],
          ["Broker auto-sync", 1]
        ]
      }
    ];
  const price = x => {
    const q = pr[x.k];
    if (!q) return `<p class="plp"><b data-nt>${he ? "חינם" : "Free"}</b></p>`;
    return `<p class="plp pm"><b data-nt>${fm(q.m)}</b><span class="plm">/ month</span></p><p class="plp py"><b data-nt>${fm(q.y)}</b><span class="plm">/ year</span><small class="mut"><span data-nt>${fm(q.y / 12)}</span> <span>/ month</span></small><small class="plsv" data-nt>${(() => {
      const sv = q.m * 12 - q.y,
        pc = Math.round((sv / (q.m * 12)) * 100);
      return he ? `חוסכים ${fm(sv)} (${pc}%)` : `Save ${fm(sv)} (${pc}%)`;
    })()}</small></p>`;
  };
  return `<section class="plans" id="plans" aria-labelledby="plh"><h2 id="plh">Plans and pricing</h2>
 <div class="plsw" role="group" aria-label="Billing period"><button type="button" class="on" data-pl="m" aria-pressed="true">Monthly</button><button type="button" data-pl="y" aria-pressed="false">Yearly</button></div>
 <p class="mut sm plrn">Yearly plans renew automatically. We'll remind you before renewal.</p>
 <div class="plg">${P.map(x => `<article class="plc${x.rec ? " rec" : ""}">${x.rec ? `<span class="plb">Recommended</span>` : ""}<h3 data-nt>${NM[x.k][he ? 1 : 0]}</h3><p class="plt">${x.t}</p>${price(x)}<button class="${x.rec ? "cta" : "gh"} plgb" type="button">${pr[x.k] ? "Start 14-day free trial" : "Start free"}</button>${x.lead ? `<p class="pll">${x.lead}</p>` : ""}<ul>${x.f.map((f, i) => (Array.isArray(f) ? `<li${i > 2 ? ' class="plx"' : ""}><span>${f[0]}</span> ${S1}</li>` : `<li${i > 2 ? ' class="plx"' : ""}><span>${f}</span></li>`)).join("")}</ul></article>`).join("")}</div>
 <p class="plall"><button type="button" class="gh sm" data-pla aria-expanded="false"><span class="pl1">See all features ▾</span><span class="pl2">Show less ▴</span></button></p>
 <p class="pln mut"><span>14-day free trial on every plan.</span> <span>The first 50 people to join get 6 months free, then 50% off for good.</span> <span>Prices may change before launch.</span></p></section>`;
}
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("[data-pla]");
  if (a) {
    const sec = a.closest(".plans"),
      on = !sec.classList.contains("all");
    sec.classList.toggle("all", on);
    a.setAttribute("aria-expanded", String(on));
    return;
  }
  const b = e.target.closest && e.target.closest("[data-pl]");
  if (!b) return;
  const y = b.dataset.pl === "y",
    sec = b.closest(".plans");
  if (!sec) return;
  sec.classList.toggle("yr", y);
  sec.querySelectorAll("[data-pl]").forEach(x => {
    const on = (x.dataset.pl === "y") === y;
    x.classList.toggle("on", on);
    x.setAttribute("aria-pressed", String(on));
  });
});
// HTML of the whole landing page.
function lsHTML() {
  for (const k in LSA) delete LSA[k];
  LSM.clear();
  for (const k in LSS) delete LSS[k];
  const he = LANG === "he",
    tick = `<span class="ls-tick" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" fill="none" stroke="#1a1400" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  const Q = [
    "Is the overall market trend on my side?",
    "Do I know exactly where my stop is?",
    "Is my risk within my 1% rule?",
    "Is the reward at least twice the risk?",
    "Am I calm, not chasing?"
  ];
  const F = he
    ? [
        ["סימול", "NVDA"],
        ["כיוון", "לונג"],
        ["כניסה", "$180.00"],
        ["סטופ", "$172.00"],
        ["יציאה", "$196.00"],
        ["תוצאה", "+2.0R"],
        ["סיבה", "פריצה מעל הבסיס עם מחזור. פעלתי לפי התוכנית."]
      ]
    : [
        ["Ticker", "NVDA"],
        ["Side", "Long"],
        ["Entry", "$180.00"],
        ["Stop", "$172.00"],
        ["Exit", "$196.00"],
        ["Result", "+2.0R"],
        ["Reason", "Breakout over the base on volume. Followed the plan."]
      ];
  return `<div class="ls-prog" id="lsp" aria-hidden="true"></div><section class="land ls ${LSW}">
<div class="ls-ch" id="ls1"><div class="ls-stage"><div class="ls-hero" id="lsh"><div class="ls-cw"><span class="ls-coach">${coAv("calm", 138)}</span><span class="ls-bub">Did you set your stop?</span></div><h1>${he ? `תכתוב את זה.<br>קח אחריות על <em>העסקה</em>.` : `Write it down.<br>Own the <em>trade</em>.`}</h1><p class="ls-sub">Five checks before you buy. One honest note after you sell.</p><p class="ls-btns"><button class="cta" id="lsplans" type="button">See plans</button><button class="gh" id="lgb" type="button">Start free</button></p><div class="ls-cards" aria-hidden="true"><div class="ls-card"><small>P&amp;L this month</small><b class="pos" data-nt>+$1,240</b><span class="mut">+4.1% · 9 <span>trades</span></span></div><div class="ls-card ls-cc"><small>Your edge</small><svg viewBox="0 0 160 60" width="100%" height="56">${[
    [8, 40, 46, 30, 26],
    [26, 32, 40, 24, 20],
    [44, 36, 44, 26, 30],
    [62, 22, 30, 16, 12],
    [80, 28, 34, 18, 14],
    [98, 14, 22, 8, 4],
    [116, 18, 24, 10, 6],
    [134, 6, 14, 2, 0]
  ]
    .map(([x, o, l, c, h], i) => {
      const up = c < o;
      return `<line x1="${x + 5}" x2="${x + 5}" y1="${h}" y2="${l}" stroke="${up ? "var(--g)" : "var(--r)"}" stroke-width="1.6"/><rect x="${x}" y="${Math.min(o, c)}" width="10" height="${Math.max(3, Math.abs(o - c))}" rx="2" fill="${up ? "var(--g)" : "var(--r)"}"/>`;
    })
    .join(
      ""
    )}</svg></div><div class="ls-card"><small>Before you buy</small><span class="ls-ck">✓ <span>Trend on my side</span></span><span class="ls-ck">✓ <span>Stop is set</span></span><span class="ls-ck">✓ <span>Risk under 1%</span></span></div></div><p class="mut sm">Free to start. Private by design: only you can see your journal.</p></div><div class="ls-hint" id="lshi"><button type="button" class="ls-chev" id="lschev" aria-label="Scroll to see how it works"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="ls-peek" aria-hidden="true"><div class="ls-q on"><span class="ls-tick"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" fill="none" stroke="#1a1400" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Is the overall market trend on my side?</span></div></div></div></div>
<div class="ls-steps"><div class="ls-ch" id="ls2"><div class="ls-stage"><div class="ls-grid"><div class="ls-tx"><div class="ls-k">Before you buy</div><h2>Five checks.<br>Every time.</h2><p class="ls-lead">A short daily pulse keeps the plan in front of you, before you press buy.</p></div>
<div class="ls-panel ls-pn">${Q.map(q => `<div class="ls-q">${tick}<span>${q}</span></div>`).join("")}<div class="ls-st" id="lsst" data-nt aria-hidden="true"></div></div></div></div></div>
<div class="ls-ch" id="ls3"><div class="ls-stage"><div class="ls-grid"><div class="ls-tx"><div class="ls-k">After you sell</div><h2>One honest note.</h2><p class="ls-lead">Log the trade and the reason. The journal does the math, so you see what really works.</p></div>
<div class="ls-panel ls-pn"><div class="ls-f" data-nt>${F.map((f, i) => `<div class="ls-fld${i === 6 ? " ls-wide" : ""}"><span class="ls-l">${f[0]}</span><div data-v="${esc(f[1])}"${i === 5 ? ' class="pos"' : ""} aria-label="${esc(f[0] + ": " + f[1])}"></div></div>`).join("")}</div></div></div></div></div>
<div class="ls-ch" id="ls4"><div class="ls-stage"><div class="ls-grid"><div class="ls-tx"><div class="ls-k">Over time</div><h2>Progress starts the day you start tracking.</h2><p class="ls-lead">Every entry adds to the picture: win rate, average R, your best setups.</p></div>
<div class="ls-panel ls-pn">${lsChart()}<div class="ls-ax" aria-hidden="true"><span>Day 1</span><span>Today</span></div></div></div></div></div>
</div>${lsPlans(he)}
${WLON ? `<form id="wl" class="card wl" novalidate><h2>Not ready yet? Join the waitlist</h2><p class="mut">Leave your email and we will keep you posted about new features and launch offers.</p><label class="vh" for="wle">Email</label><input type="email" id="wle" maxlength="254" autocomplete="email" placeholder="you@example.com"><label class="chk"><input type="checkbox" id="wlc"> I agree to receive updates and offers about TradeInk by email. I can unsubscribe at any time.</label><button class="cta" type="submit">Join the waitlist</button><p id="wlm" class="mut sm" role="status"></p></form>` : ""}</section>`;
}
// Landing animation timers and durations.
const LSA = {},
  LSD = { ls2: 6000, ls3: 7500, ls4: 6000 };
// Landing animation loop running.
let lsRun = false;
// Progress of an auto-playing landing step.
function lsAuto(id) {
  const el = $(id);
  if (!el) return 0;
  if (LSA[id] == null) {
    const rr = el.getBoundingClientRect();
    if (
      rr.top < innerHeight * (LSC0() ? 0.75 : 0.2) &&
      (!el.closest(".hsnap") || (rr.left < innerWidth * 0.6 && rr.right > innerWidth * 0.4))
    ) {
      LSA[id] = performance.now();
      if (!lsRun) {
        lsRun = true;
        requestAnimationFrame(lsLoop);
      }
    } else return 0;
  }
  return Math.min(1, (performance.now() - LSA[id]) / LSD[id]);
}
// Landing animation loop.
function lsLoop() {
  lsFrame();
  const now = performance.now();
  if (Object.keys(LSA).some(k => now - LSA[k] < LSD[k] + 50) && document.querySelector(".ls"))
    requestAnimationFrame(lsLoop);
  else lsRun = false;
}
/* Apple-style motion: values ease toward their scroll target every frame (time-based, so equally smooth on any screen).
   Chapters overlap: the next one rises in while the previous one drifts away, so the screen is never empty. Native scrolling is untouched. */
// Landing motion targets.
const LSM = new Map();
// Landing motion loop state.
let lsMR = false,
  lsMT = 0;
// Where each landing element should be for the scroll position.
function lsTarget() {
  const out = [],
    rm = lsRM(),
    H = innerHeight,
    cl = v => Math.min(1, Math.max(0, v)),
    ease = t => 1 - Math.pow(1 - t, 3);
  const h = $("lsh");
  if (h && !LSC0()) {
    const p = rm ? 0 : lsP("ls1");
    out.push([h, { o: 1 - p, y: -p * 36, s: 1 - p * 0.08 }]);
  }
  for (const id of ["ls2", "ls3", "ls4"]) {
    const sec = $(id);
    if (!sec) continue;
    const r = sec.getBoundingClientRect(),
      tx = sec.querySelector(".ls-tx"),
      pn = sec.querySelector(".ls-pn");
    if (rm) {
      if (tx) out.push([tx, { o: 1, y: 0, s: 1 }]);
      if (pn) out.push([pn, { o: 1, y: 0, s: 1 }]);
      continue;
    }
    if (LSC0()) {
      const e = Math.max(sec._e || 0, ease(cl((H - r.top) / H / 0.32)));
      sec._e = e;
      if (tx) out.push([tx, { o: e, y: (1 - e) * 20, s: 1 }]);
      if (pn) out.push([pn, { o: e, y: (1 - e) * 28, s: 1 }]);
      continue;
    }
    const a = (H - r.top) / H,
      e1 = ease(cl(a / 0.42)),
      e2 = ease(cl((a - 0.06) / 0.42)),
      ex = cl((H - r.bottom) / (H * 0.55)),
      fade = 1 - ex * 0.55,
      shrink = 1 - ex * 0.035;
    if (tx) out.push([tx, { o: e1 * fade, y: (1 - e1) * 44, s: shrink }]);
    if (pn) out.push([pn, { o: e2 * fade, y: (1 - e2) * 64, s: (0.955 + e2 * 0.045) * shrink }]);
  }
  return out;
}
// Start the smooth landing motion.
function lsMotion() {
  if (!lsMR) {
    lsMR = true;
    lsMT = 0;
    requestAnimationFrame(lsMStep);
  }
}
// One frame of the landing motion.
function lsMStep(t) {
  const dt = lsMT ? Math.min(64, t - lsMT) : 16.7;
  lsMT = t;
  const a = 1 - Math.exp(-dt / 70);
  let busy = false;
  const rm = lsRM();
  for (const [el, g] of lsTarget()) {
    let c = LSM.get(el);
    if (!c || rm) {
      c = { ...g };
      LSM.set(el, c);
    }
    for (const k of ["o", "y", "s"]) {
      const d = g[k] - c[k];
      if (Math.abs(d) > (k === "y" ? 0.02 : 0.0002)) {
        c[k] += d * a;
        busy = true;
      } else c[k] = g[k];
    }
    const o = Math.max(0, Math.min(1, c.o)).toFixed(3),
      tr = rm ? "" : `translate3d(0,${c.y.toFixed(2)}px,0) scale(${c.s.toFixed(4)})`;
    if (el._o !== o) {
      el._o = o;
      el.style.opacity = o;
    }
    if (el._t !== tr) {
      el._t = tr;
      el.style.transform = tr;
    }
  }
  if (busy && document.querySelector(".ls")) requestAnimationFrame(lsMStep);
  else lsMR = false;
}
// Scroll progress through a landing section (0 to 1).
function lsP(id) {
  const el = $(id);
  if (!el) return 0;
  const r = el.getBoundingClientRect(),
    run = el.offsetHeight - innerHeight;
  return run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 1;
}
// Landing state cache.
const LSS = {};
// Run fn only when a landing value changes.
function lsSet(k, v, fn) {
  if (LSS[k] !== v) {
    LSS[k] = v;
    fn();
  }
}
// Update the landing page for the scroll position.
function lsFrame() {
  const root = document.querySelector(".ls");
  if (!root) return;
  const rm = lsRM(),
    he = LANG === "he",
    d = document.documentElement;
  const pb = $("lsp");
  if (pb) {
    const w = rm
      ? 0
      : Math.round((scrollY / Math.max(1, d.scrollHeight - innerHeight)) * 1000) / 10;
    lsSet("pb", w, () => (pb.style.transform = `scaleX(${w / 100})`));
  }
  const p1 = rm ? 0 : lsP("ls1"),
    hi = $("lshi"),
    pk = document.querySelector(".ls-peek");
  if (hi) {
    const o = Math.round(Math.max(0, 1 - p1 * 4) * 100) / 100;
    lsSet("hi", o, () => {
      hi.style.opacity = String(o);
      hi.style.visibility = o ? "" : "hidden";
      if (pk) {
        pk.style.opacity = String(o);
        pk.style.visibility = o ? "" : "hidden";
      }
    });
  }
  lsMotion();
  const p2 = rm ? 1 : lsAuto("ls2"),
    n = Math.min(5, Math.floor(p2 * 6));
  lsSet("n", n, () => {
    root.querySelectorAll(".ls-panel .ls-q").forEach((q, i) => q.classList.toggle("on", i < n));
    const st = $("lsst");
    if (st) {
      st.textContent =
        n === 5
          ? he
            ? "מוכן לעסקה"
            : "Ready to trade"
          : he
            ? `${n} מתוך 5 סומנו`
            : `${n} of 5 checked`;
      st.classList.toggle("ok", n === 5);
    }
  });
  const fl = [...root.querySelectorAll(".ls-f [data-v]")],
    tot = fl.reduce((a, f) => a + f.dataset.v.length, 0),
    p3 = rm ? 1 : lsAuto("ls3"),
    typed = Math.round(p3 * tot);
  lsSet("ty", typed, () => {
    let left = typed,
      car = false;
    fl.forEach(f => {
      const v = f.dataset.v,
        k = Math.max(0, Math.min(v.length, left));
      left -= v.length;
      f.textContent = v.slice(0, k);
      if (!car && k < v.length && typed < tot) {
        f.insertAdjacentHTML("beforeend", '<span class="ls-car"></span>');
        car = true;
      } else if (k < v.length) car = true;
    });
  });
  const p4 = rm ? 1 : lsAuto("ls4"),
    cd = root.querySelectorAll(".ls-cd"),
    nc = Math.round(Math.min(1, p4 * 1.15) * cd.length),
    qo = rm || p4 > 0.85;
  lsSet("nc", nc, () => cd.forEach((c, i) => c.classList.toggle("on", i < nc)));
  lsSet("q", qo, () => {
    const q = $("lsq");
    if (q) q.classList.toggle("on", qo);
  });
}
// Scroll update waiting for the next frame.
let lsT = false;
addEventListener(
  "scroll",
  () => {
    if (lsT || !document.querySelector(".ls")) return;
    lsT = true;
    requestAnimationFrame(() => {
      lsT = false;
      lsFrame();
    });
  },
  { passive: true }
);
addEventListener("resize", () => lsFrame());
