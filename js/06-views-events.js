/*
 * 06-views-events.js — part of the TradeInk app script.
 *
 * Rendering and the main event handlers.
 * - HERO: headline text per profile. heroSet() updates the top of the page.
 * - view(): draws the open tab into #v. It is one large function that renders every tab
 *   (Strategy, Daily pulse, Screening, Calculator, Journal, Dashboard, Monthly, Watchlist).
 * - hs(): the small P&L box at the top.
 * - document listeners: typing, tooltips, clicks on buttons, file import, the add-trade
 *   and add-to-watchlist forms.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Headline texts per profile.
const HERO = {
  swing: [
    "Write it down.",
    "Own the trade.",
    "Five checks before you buy. One honest note after you sell. Private to your account.",
    "jr",
    "Log a trade"
  ],
  day: [
    "Plan the day.",
    "Trade the plan.",
    "A short check before the open. One honest note after every trade. Private to your account.",
    "jr",
    "Log a trade"
  ],
  lt: [
    "Invest with a plan.",
    "Stay with it.",
    "Check before you buy. Deposit on schedule. Watch it grow. Private to your account.",
    "pf",
    "Open my portfolio"
  ]
};
// Journal table: show all columns? (remembered on this device)
let JALL = false;
try {
  JALL = localStorage.getItem("tj_jcols") === "all";
} catch (e) {}
// How many journal rows are shown ("Show more" adds 50).
let JN = 50;
// Phone-width media query.
const JM = matchMedia("(max-width:640px)");
// Redraw the journal / watchlist when switching between phone and desktop width.
try {
  JM.addEventListener("change", () => {
    if (tab === "jr" || tab === "wl") view();
  });
} catch (e) {}
// Which headline is shown now.
let heroK = null;
// Set the headline: the open tab's own headline (18b-tab-hero.js), or on the Dashboard the one for the chosen profile.
function heroSet() {
  const P = (S.prof || []).filter(p => PRN[p]);
  if ($("hpf")) {
    const ck = P.join() + "|" + LANG;
    if ($("hpf").dataset.k !== ck) {
      $("hpf").dataset.k = ck;
      $("hpf").innerHTML = P.length
        ? `<button class="pchip" data-t="str" aria-label="${esc(tr("Your profile") + ": " + P.map(p => tr(PRN[p])).join(", ") + ". " + tr("Change it in Strategy"))}" data-nt>${P.map(p => esc(tr(PRN[p]))).join(" · ")} <span aria-hidden="true">✎</span></button>`
        : `<button class="pchip pnone" data-t="str">Pick your profile <span aria-hidden="true">→</span></button>`;
    }
  }
  if (typeof heroCard === "function") heroCard();
  if (typeof heroTab === "function" && heroTab()) return;
  const H = HERO[P[0] || "swing"],
    k = P.join() + "|" + LANG;
  if (k === heroK || !$("hh1")) return;
  heroK = k;
  $("hh1").innerHTML = `<span>${H[0]}</span><br><span>${H[1]}</span>`;
  $("hsb").textContent = H[2];
  const c = $("hcta");
  c.dataset.t = H[3];
  c.textContent = H[4];
}
// The previous tab (for the slide direction).
let aplTab = null;
// Draw the open tab into #v. Renders every tab; called after every change.
function view() {
  // The P&L box first, so new prices show on every tab even if drawing the tab below fails.
  try {
    hs();
  } catch (e) {}
  ltSync();
  {
    // A finished check starts fresh: a rejected screening clears when you leave it,
    // and the daily pulse clears on a new day.
    let ch = pulseDay();
    if (scrDay()) ch = true;
    // A finished screening clears when you leave it. If it passed, the ticker moves to the
    // risk calculator and the calculator remembers that this ticker passed.
    if (scrFrom === "scr" && tab !== "scr" && scrDone()) {
      if (scrOK() && S.scr.t) {
        if (!S.calc.t) S.calc.t = S.scr.t;
        S.calc.ok = S.scr.t;
      }
      scrNew();
      ch = true;
    }
    scrFrom = tab;
    if (ch) save();
  }
  heroSet();
  const aplFrom = aplTab;
  aplTab = tab;
  {
    const N = navTabs(),
      bt = t =>
        `<button class="${tab === t[0] ? "on" : "gh"}${N.more.includes(t) ? " nm" : ""}" data-t="${t[0]}"${tab === t[0] ? ' aria-current="page"' : ""}>${t[1]}</button>`,
      showM = NAVM || N.more.some(t => t[0] === tab);
    $("nav").innerHTML =
      N.main.map(bt).join("") +
      (N.more.length
        ? `<button class="gh nmb" data-a="nmore" aria-expanded="${showM}">${showM ? "Less ▴" : "More ▾"}</button>` +
          (showM ? N.more.map(bt).join("") : "")
        : "");
  }
  {
    const n = $("nav"),
      on = n.querySelector(".on");
    if (on && n.scrollWidth > n.clientWidth) {
      const a = on.getBoundingClientRect(),
        b = n.getBoundingClientRect();
      n.scrollLeft += a.left + a.width / 2 - (b.left + b.width / 2);
    }
  }
  document.body.classList.toggle("lo", !!(FB && !U));
  if (FB && !U) {
    $("hs").innerHTML = "";
    $("lv").textContent = "";
    $("v").innerHTML = lsHTML();
    wlInit();
    hsInit();
    lsFrame();
    for (const id of ["lshow", "lschev"]) {
      const b = $(id);
      if (b)
        b.onclick = () => {
          const t = $("ls2");
          if (t)
            scrollTo({
              top: t.getBoundingClientRect().top + scrollY,
              behavior: lsRM() ? "auto" : "smooth"
            });
        };
    }
    document.querySelectorAll("#lgb,#lgb2,.plgb").forEach(b => (b.onclick = () => $("au").click()));
    {
      const sp = $("lsplans");
      if (sp)
        sp.onclick = () => {
          const t = $("plans");
          if (t)
            scrollTo({
              top: t.getBoundingClientRect().top + scrollY - 10,
              behavior: lsRM() ? "auto" : "smooth"
            });
        };
    }
    return;
  }
  let h = "";
  if (tab === "str") h = strPage();
  if (tab === "pf") {
    ltOpen = false;
    h = `<div class="card pfp"><div id="ltpg">${ltPageHTML()}</div></div>`;
  }
  if (tab === "pulse")
    h = `<div class="card">${ltOnly() ? `<h2>Check-in before you invest</h2><p class="mut">Complete before every deposit or new purchase.</p>` : `<h2>Mental and macro pulse check</h2><p class="mut">Complete at the start of every trading day, before opening your trading platform.</p>`}${qblock("pulse")}${ltOnly() ? gate(S.pulse, "Ready: go ahead with your plan", "Not now: wait and check again", QP().length) : gate(S.pulse, "Approved: continue to step 2", "Stop for today: do not trade", QP().length)}<p><button class="gh sm" data-a="rp">Reset for a new day</button></p></div>`;
  if (tab === "scr")
    h = `<div class="card"><h2>${ltOnly() ? "Before you buy a stock or fund" : "Candidate stock screening"}</h2><div class="f" style="max-width:260px;margin:8px 0"><label>Ticker<input data-k="st" value="${esc(S.scr.t)}" style="text-transform:uppercase"></label></div>${qblock("scr")}${ltOnly() ? gate(S.scr.a, "Passes: it fits your plan", "Not yet: every answer should be “Yes”", QS().length) : gate(S.scr.a, "Passes to step 3: risk calculator", "Not all your criteria are met (each must be “Yes”)", QS().length)}<p><button class="gh sm" data-a="rs">Screen another stock</button></p></div>`;
  if (tab === "calc") {
    const r = calc(),
      p = S.set,
      c = S.calc;
    h = `<div class="two"><div class="card"><details id="ds"${setOpen ? " open" : ""}><summary>Account and risk settings</summary><p class="mut" style="margin:8px 0 0">Current account <b>${$f(acct())}</b> (starting size plus closed-trade P&amp;L) · Invested <b>${$f(inv() + ltInvC())}</b> · Free cash <b class="${cash() < 0 ? "neg" : ""}">${$f(cash())}</b></p><div class="f" style="margin-top:10px"><label>Starting account size ($)<input type="number" data-k="pf" value="${p.pf}"></label><label>Allocation per position (%)<input type="number" step="any" data-k="al" value="${p.al * 100}"></label><label>Max $ risk per trade (% of account)<input type="number" step="any" data-k="mr" value="${p.mr * 100}"></label><label>Minimum R:R<input type="number" step="any" data-k="rr" value="${p.rr}"></label></div></details>
  <h2 style="margin-top:16px">Planned trade</h2><div class="f"><label>Ticker<input data-k="ct" value="${esc(c.t)}" style="text-transform:uppercase"></label><label>Direction<select data-k="cd"><option${c.dir === "Long" ? " selected" : ""}>Long</option><option${c.dir === "Short" ? " selected" : ""}>Short</option></select></label><label>Entry price ($)<input type="number" step="any" data-k="ce" value="${c.e}"></label><label>Stop-loss price ($)<input type="number" step="any" data-k="cs" value="${c.s}"></label><label>Target price ($)<input type="number" step="any" data-k="cg" value="${c.tg}"></label><label>Position size ($), optional<input type="number" step="any" data-k="ca" value="${esc(c.amt ?? "")}" placeholder="${r ? "auto: " + Math.round(r.mode === "amount" ? r.cost : Math.floor(S.set.al * acct())) : "auto"}"></label><label style="grid-column:1/-1">Reason for entry<textarea data-k="cth" rows="3" maxlength="2000" placeholder="Why this trade? Setup, trigger, what makes you wrong.">${esc(c.th ?? "")}</textarea></label><label>Shares, optional<input type="number" step="any" data-k="cn" value="${esc(c.shs ?? "")}" placeholder="${r ? "auto: " + (r.mode === "alloc" ? r.sh : Math.round((acct() * S.set.al) / r.e)) : "auto"}"></label></div></div>
  <div class="card"><h2>Automatic calculations</h2>${
    r
      ? `<div class="res"><div><span>Risk per share</span><b>${$f(r.rps, 2)}</b></div><div><span>Potential profit per share</span><b>${$f(r.pps, 2)}</b></div><div><span>Shares ${r.mode === "alloc" ? "(by fixed allocation)" : r.mode === "amount" ? "(from your amount)" : "(your number)"}</span><b>${r.sh}</b></div><div><span>Position cost</span><b>${$f(r.cost, 2)}</b></div><div><span>Free cash after this trade</span><b class="${r.cashAfter < 0 ? "neg" : ""}">${$f(r.cashAfter, 2)}</b></div><div><span>% of account</span><b>${(r.pct * 100).toFixed(1)}%</b></div><div><span>$ risk in the trade</span><b>${$f(r.rk, 2)}</b></div><div><span>% of account at risk</span><b>${(r.rkp * 100).toFixed(2)}%</b></div><div><span>Risk:reward</span><b>1:${r.R.toFixed(2)}</b></div><div><span>Potential profit at target</span><b>${$f(r.prof, 2)}</b></div></div>
  <div class="status ${r.ok ? "ok" : "no"}">${!r.valid ? "Stop and target must be on the correct sides of entry" : r.ok ? "Within your risk rules" : "Outside your risk rules: R:R below your minimum or $ risk above your cap"}</div>
  ${!pulseOK() || !(scrOK() || (c.ok && c.ok === String(c.t || "").toUpperCase())) ? `<p class="neg">Steps 1 and 2 are not fully approved yet.</p>` : ""}
  ${r.ok ? `<h2 style="margin-top:14px">Broker order ticket</h2><div class="res"><div><span>Entry order</span><b>${$f(r.e, 2)}</b></div><div><span>Shares</span><b>${r.sh}</b></div><div><span>Stop-loss order</span><b>${$f(r.s, 2)}</b></div><div><span>Target order</span><b>${$f(r.tg, 2)}</b></div></div><p class="mut">Enter all three orders at the broker right after approval.</p><button data-a="tj">Add to trade journal</button>` : ""}`
      : `<p class="mut">Enter entry, stop and target prices to see the calculation.</p>`
  }</div></div>`;
  }
  if (tab === "jr") {
    const rowsAll = [...S.trades].sort((a, b) =>
        a.d < b.d ? 1 : a.d > b.d ? -1 : a.id < b.id ? 1 : -1
      ),
      rows = rowsAll.slice(0, JN),
      mob = JM.matches,
      more =
        rowsAll.length > rows.length
          ? `<p class="jpg"><button class="gh" data-a="jmore">Show more trades</button> <span class="mut sm"><span>Showing</span> <span class="ltn">${rows.length}</span> <span>of</span> <span class="ltn">${rowsAll.length}</span></span></p>`
          : "";
    h = `<details class="card wlf jimp"${IMP ? " open" : ""}><summary>Import trades</summary><p class="mut">Upload your own journal from Excel or Google Sheets (an .xlsx or CSV file; in Google Sheets: File → Download → Microsoft Excel), or a CSV file from your broker (for example Interactive Brokers). We recognize the columns automatically, you can check and fix everything before the trades are added, and they are sorted by date in your journal. Your file is read on your device and is not uploaded anywhere.</p><p><label class="bl" for="imf">Choose file</label><input type="file" id="imf" accept=".xlsx,.xls,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="vh"></p>${IMP ? `<div id="imp">${impTable()}</div>` : ""}</details><div class="card"><h2>Add a trade</h2><form id="tf" class="f"><label>Entry date<input type="text" readonly class="dpk" name="d" required value="${(() => {
      const n = new Date();
      return (
        n.getFullYear() +
        "-" +
        String(n.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(n.getDate()).padStart(2, "0")
      );
    })()}"></label><label>Ticker<input name="t" required style="text-transform:uppercase"></label><label>Direction<select name="dir"><option>Long</option><option>Short</option></select></label><label>Entry price<input type="number" step="any" name="e" required></label><label>Stop<input type="number" step="any" name="s"></label><label>Target<input type="number" step="any" name="tg"></label><label>Shares<input type="number" step="any" name="sh" required></label><label>Position size ($)<input type="number" step="any" name="amt"><small id="amh" class="mut">&nbsp;</small></label><label>Mindset (1-5)<input type="number" min="1" max="5" name="m"></label><label style="grid-column:1/-1">Thesis / entry reasons<textarea name="th" rows="2"></textarea></label><div><button>Save trade</button></div></form></div>
  ${
    mob
      ? ""
      : `<div class="jcolsw"><button type="button" class="gh sm" data-a="jcols" aria-pressed="${JALL}">${JALL ? "Fewer columns" : "All columns"}</button></div><div class="card wrap jwrap${JALL ? " allc" : ""}" tabindex="0" role="region" aria-label="Table, scrollable"><table class="jt"><thead><tr><th>Date</th><th>Ticker</th><th>Side</th><th class="rc">Reason for entry</th><th>Entry</th><th>Stop</th><th>Target</th><th>Shares</th><th>Size</th><th>Risk $</th><th>Plan R:R</th><th>Exit</th><th>Exit date</th><th>Current price</th><th class="rc">Exit type</th><th class="rc">Reason for exit</th><th>P&amp;L</th><th>R</th><th>Mind</th><th class="rc">Rules</th><th></th></tr></thead><tbody>
  ${
    rows
      .map(t => {
        const p = pnl(t) ?? fl(t),
          R = aR(t);
        return `<tr><td><input type="text" readonly class="ti dt dpk" data-k="tdt" data-id="${t.id}" value="${esc(t.d)}" aria-label="Entry date ${esc(t.t)}"></td><td><b data-n="${t.id}" style="cursor:pointer">${esc(t.t)}</b></td><td>${t.dir}</td><td class="rc"><div class="rbox${t.th ? "" : " empty"}" data-n="${t.id}" role="button" tabindex="0">${t.th ? esc(t.th.slice(0, 70)) + (t.th.length > 70 ? "…" : "") : "Add reason"}</div></td><td><input type="number" step="any" class="ti" data-k="te" data-id="${t.id}" value="${t.e ?? ""}" aria-label="Entry price ${esc(t.t)}"></td><td><input type="number" step="any" class="ti" data-k="ts" data-id="${t.id}" value="${t.s ?? ""}" aria-label="Stop ${esc(t.t)}"></td><td><input type="number" step="any" class="ti" data-k="tg" data-id="${t.id}" value="${t.tg ?? ""}" aria-label="Target ${esc(t.t)}"></td><td><input type="number" step="any" class="ti" data-k="tsh" data-id="${t.id}" value="${t.sh ?? ""}" aria-label="Shares ${esc(t.t)}"></td><td>${$f(cost(t), 0)} <small class="mut">${((cost(t) / acct()) * 100).toFixed(1)}%</small></td><td>${$f(risk(t), 0)}</td><td>${rr(t) == null ? "–" : rr(t).toFixed(1)}</td><td>${t.x == null ? "open" : `<input type="number" step="any" class="ti" data-k="tx" data-id="${t.id}" value="${t.x}" aria-label="Exit price ${esc(t.t)}">`}</td><td>${t.x == null ? "–" : `<input type="text" readonly class="ti dt dpk" data-k="txd" data-id="${t.id}" value="${esc(t.xd || "")}" placeholder="Set date" aria-label="Exit date ${esc(t.t)}">`}</td><td>${t.x == null ? (lp(t) == null ? "–" : $f(lp(t), 2)) : "–"}</td><td class="rc">${t.x == null ? "–" : `<select data-k="trs" data-id="${t.id}" aria-label="Exit type ${esc(t.t)}"><option value="">Choose</option>${RSL.map(o => `<option${t.rs === o ? " selected" : ""}>${o}</option>`).join("")}</select>`}</td><td class="rc">${t.x == null ? "–" : `<div class="rbox${t.xr ? "" : " empty"}" data-n="${t.id}" role="button" tabindex="0">${t.xr ? esc(t.xr.slice(0, 70)) + (t.xr.length > 70 ? "…" : "") : "Add reason"}</div>`}</td><td class="${p > 0 ? "pos" : p < 0 ? "neg" : ""}">${$f(p, 2)}</td><td>${rCell(t)}</td><td>${t.m ?? "–"}</td><td class="rc">${rkUI(t)}</td><td>${t.x == null ? `<button class="ib ibc" data-a="cl" data-id="${t.id}" aria-label="${esc(tr("Close trade") + " " + t.t)}" title="${esc(tr("Close trade"))}"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12.5l2.7 2.7L16.5 9.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ""}${t.x != null ? `<button class="ib" data-a="ro" data-id="${t.id}" aria-label="${esc(tr("Reopen") + " " + t.t)}" title="${esc(tr("Reopen"))}"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ""}${coAskBtn(t)}<button class="ib ibd" data-a="dl" data-id="${t.id}" aria-label="${esc(tr("Delete") + " " + t.t)}" title="${esc(tr("Delete"))}"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></td></tr>${openN === t.id ? `<tr><td colspan="21" class="n"><label style="display:block;margin-top:6px">Reason for entry<textarea data-k="tth" data-id="${t.id}" rows="4" maxlength="2000" placeholder="Why did you take this trade?">${esc(t.th || "")}</textarea></label>${t.x != null ? `<label style="display:block;margin-top:8px">Reason for exit<textarea data-k="txr" data-id="${t.id}" rows="3" maxlength="2000" placeholder="Why did you close it? Stop, target, plan changed, fear...">${esc(t.xr || "")}</textarea></label>` : ""}${t.ls ? "<br><b>Lessons:</b> " + esc(t.ls) : ""}</td></tr>` : ""}`;
      })
      .join("") ||
    `<tr><td colspan="21" class="mut" style="text-align:center">Nothing logged yet. Add your first trade in the form above.</td></tr>`
  }</tbody></table></div>`
  }${mob ? jCards(rows) : ""}${more}<p class="mut">Click a ticker to read its notes.</p>`;
  }
  if (tab === "dash") {
    const cl = S.trades.filter(t => t.x != null).sort((a, b) => (a.d < b.d ? -1 : 1)),
      P = cl.map(pnl),
      W = P.filter(x => x > 0),
      Lo = P.filter(x => x < 0),
      net = P.reduce((a, b) => a + b, 0),
      gw = W.reduce((a, b) => a + b, 0),
      gl = Math.abs(Lo.reduce((a, b) => a + b, 0)),
      Rs = cl.map(aR).filter(x => x != null),
      rw = Rs.filter(x => x > 0),
      rl = Rs.filter(x => x <= 0),
      av = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null),
      ms = S.trades.map(t => t.m).filter(x => x != null);
    const K = [
      ["Closed trades", cl.length],
      ["Win rate", cl.length ? Math.round((W.length / cl.length) * 100) + "%" : "–"],
      ["Avg R on wins", av(rw) == null ? "–" : av(rw).toFixed(2) + "R"],
      ["Avg R on losses", av(rl) == null ? "–" : av(rl).toFixed(2) + "R"],
      ["Expectancy (avg R)", av(Rs) == null ? "–" : av(Rs).toFixed(2) + "R"],
      ["Profit factor", gl ? (gw / gl).toFixed(2) : "–"],
      ["Cumulative P&L", $f(net), net],
      ["Return on portfolio", ((net / S.set.pf) * 100).toFixed(1) + "%", net],
      ["Avg mindset (1-5)", av(ms) == null ? "–" : av(ms).toFixed(1)],
      ["Open positions", S.trades.length - cl.length]
    ];
    let c = 0;
    const pts = [0, ...P.map(p => (c += p))],
      Wd = 720,
      H = 240,
      Lm = 56,
      Rm = 12,
      Tm = 12,
      B = 24,
      mn = Math.min(...pts),
      mx = Math.max(...pts, 0),
      sp = mx - mn || 1,
      X = i => Lm + (i * (Wd - Lm - Rm)) / Math.max(pts.length - 1, 1),
      Y = v => Tm + ((mx - v) * (H - Tm - B)) / sp;
    let sv = "";
    for (let i = 0; i <= 4; i++) {
      const v = mn + (sp * i) / 4;
      sv += `<line x1="${Lm}" x2="${Wd - Rm}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${Lm - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--mut)">${$f(v)}</text>`;
    }
    sv += `<line x1="${Lm}" x2="${Wd - Rm}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--mut)" stroke-dasharray="4 3"/>`;
    if (CT === "m") {
      const G = [];
      let cu = 0;
      cl.forEach((t, i) => {
        const k = t.d.slice(0, 7);
        let g = G[G.length - 1];
        if (!g || g.k !== k) {
          g = { k, o: cu, h: cu, l: cu };
          G.push(g);
        }
        cu += P[i];
        g.c = cu;
        g.h = Math.max(g.h, cu);
        g.l = Math.min(g.l, cu);
      });
      const n = Math.max(G.length, 1),
        bw = (Wd - Lm - Rm) / n,
        cw = Math.max(5, Math.min(40, bw * 0.55));
      G.forEach((g, i) => {
        const cx = Lm + (i + 0.5) * bw,
          col = g.c >= g.o ? "var(--g)" : "var(--r)",
          y1 = Y(Math.max(g.o, g.c)),
          y2 = Y(Math.min(g.o, g.c));
        sv += `<line x1="${cx}" x2="${cx}" y1="${Y(g.h)}" y2="${Y(g.l)}" stroke="${col}" stroke-width="2"/><rect x="${cx - cw / 2}" y="${y1}" width="${cw}" height="${Math.max(2, y2 - y1)}" rx="2" fill="${col}" data-tip="${esc(tipT(new Date(g.k + "-15T12:00:00").toLocaleString(LANG === "he" ? "he-IL" : "en-US", { month: "long", year: "numeric" }), g.c - g.o, S.set.pf + g.o, g.h - g.o, g.l - g.o))}" tabindex="0"></rect><text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--mut)">${g.k.slice(5)}/${g.k.slice(2, 4)}</text>`;
      });
    } else if (CT === "c") {
      const n = Math.max(P.length, 1),
        bw = (Wd - Lm - Rm) / n,
        cw = Math.max(3, Math.min(26, bw * 0.6));
      P.forEach((v, i) => {
        const o = pts[i],
          e = pts[i + 1],
          cx = Lm + (i + 0.5) * bw,
          y1 = Y(Math.max(o, e)),
          y2 = Y(Math.min(o, e)),
          col = e >= o ? "var(--g)" : "var(--r)";
        sv += `<rect x="${cx - cw / 2}" y="${y1}" width="${cw}" height="${Math.max(2, y2 - y1)}" rx="2" fill="${col}" data-tip="${esc(tipT(cl[i].t + " " + cl[i].d, v, S.set.pf + o))}" tabindex="0"></rect>`;
      });
    } else if (pts.length > 1)
      sv +=
        `<polyline fill="none" stroke="var(--ac)" stroke-width="2.5" points="${pts.map((v, i) => X(i) + "," + Y(v)).join(" ")}"/>` +
        pts.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="var(--ac)"/>`).join("");
    const DB = {
      prog: pcard(),
      kpi: `<div class="kp">${K.map(k => `<div class="k"><small>${k[0]}</small><b class="${k[2] > 0 ? "pos" : k[2] < 0 ? "neg" : ""}">${k[1]}</b></div>`).join("")}</div>`,
      rules: rulesDash(),
      lt: ltDash(net),
      today: dbToday(),
      alloc: dbAlloc(),
      swing: dbSwing(),
      inv: dbInv()
    };
    DB.chart = `<div class="card" style="margin-top:12px"><div class="ctg"><h2>Cumulative P&amp;L by closed trade</h2><span class="tg2" role="group" aria-label="Chart type"><button class="gh sm${CT === "l" ? " on" : ""}" data-a="ct" data-v="l" aria-pressed="${CT === "l"}">Line</button><button class="gh sm${CT === "c" ? " on" : ""}" data-a="ct" data-v="c" aria-pressed="${CT === "c"}">Trade candles</button><button class="gh sm${CT === "m" ? " on" : ""}" data-a="ct" data-v="m" aria-pressed="${CT === "m"}">Monthly candles</button></span></div>${CT === "m" ? `<p class="mut sm">Each candle is one trading month (grouped by entry date, like the monthly report). The body goes from your running total at the start of the month to the end; the thin line shows the highest and lowest total reached during the month. Green = profit, red = loss.</p>` : CT === "c" ? `<p class="mut sm">Each candle is one closed trade: it goes from your running total before the trade to your running total after it. Green = profit, red = loss.</p>` : ""}<svg viewBox="0 0 720 240" role="img" aria-label="Cumulative profit and loss">${sv}</svg>${CT === "l" ? "" : `<p id="ctip" class="ctip" role="status" aria-live="polite">${LANG === "he" ? "העבר את העכבר על נר (או לחץ עליו) כדי לראות רווח/הפסד בדולרים ובאחוזים." : "Hover over a candle (or tap it) to see profit or loss in dollars and percent."}</p>`}</div>`;
    h = dashOrder()
      .map(k =>
        k === "trade"
          ? `<details class="card dbtr"><summary>Trading stats</summary>${DB.kpi}${DB.chart}${DB.rules}</details>`
          : DB[k] || ""
      )
      .join("");
  }
  if (tab === "mon") {
    const cl = S.trades.filter(t => t.x != null),
      M = {};
    cl.forEach(t => {
      const k = t.d.slice(0, 7);
      (M[k] = M[k] || []).push(t);
    });
    let cum = 0;
    const rows = Object.keys(M)
      .sort()
      .map(k => {
        const a = M[k],
          p = a.reduce((s, t) => s + pnl(t), 0),
          w = a.filter(t => pnl(t) > 0).length,
          rs = a.map(aR).filter(x => x != null),
          r = rs.length ? rs.reduce((x, y) => x + y, 0) / rs.length : null;
        cum += p / S.set.pf;
        return `<tr><td>${k}</td><td>${a.length}</td><td class='${p > 0 ? "pos" : "neg"}'>${$f(p, 2)}</td><td>${((p / S.set.pf) * 100).toFixed(2)}%</td><td>${(cum * 100).toFixed(2)}%</td><td>${Math.round((w / a.length) * 100)}%</td><td>${r == null ? "–" : r.toFixed(2) + "R"}</td></tr>`;
      })
      .join("");
    const tp = cl.reduce((s, t) => s + pnl(t), 0);
    h = `<div class='card wrap' tabindex='0' role='region' aria-label='Table, scrollable'><h2>Monthly summary</h2><p class='mut'>Closed trades grouped by entry month. Return is measured against your portfolio size.</p><table style='min-width:560px'><thead><tr><th>Month</th><th>Trades</th><th>P&amp;L</th><th>Return</th><th>Cumulative</th><th>Win rate</th><th>Avg R</th></tr></thead><tbody>${rows || `<tr><td colspan='7' class='mut'>No closed trades yet.</td></tr>`}<tr><td><b>Total</b></td><td><b>${cl.length}</b></td><td class='${tp > 0 ? "pos" : "neg"}'><b>${$f(tp, 2)}</b></td><td colspan='4'></td></tr></tbody></table></div>`;
  }
  if (tab === "wl") {
    const sig = w => {
      const e = num(w.e),
        s = num(w.s),
        p = wp(w);
      if (!e || !p) return "–";
      const L = w.dir !== "Short";
      if (s && (L ? p <= s : p >= s)) return "<span class='sg r'>Stop broken</span>";
      return (L ? p >= e : p <= e)
        ? "<span class='sg g'>Trigger hit</span>"
        : "<span class='sg w'>Waiting</span>";
    };
    const mob = JM.matches;
    h = `<details class='card wlf'${S.wl.length ? "" : " open"}><summary>Add to watchlist</summary><form id='wf' class='f'><label>Ticker<input name='t' required style='text-transform:uppercase'></label><label>Direction<select name='dir'><option>Long</option><option>Short</option></select></label><label>Planned entry<input type='number' step='any' name='e'></label><label>Planned stop<input type='number' step='any' name='s'></label><label>Planned target<input type='number' step='any' name='tg'></label><label>Current price<input type='number' step='any' name='p'></label><div><button>Add</button></div></form></details>${
      mob
        ? wlCards(sig)
        : `<div class='card wrap' tabindex='0' role='region' aria-label='Table, scrollable'><table class='wlt' style='min-width:780px'><thead><tr><th>Ticker</th><th>Side</th><th>Entry</th><th>Stop</th><th>Target</th><th>Price</th><th>To entry</th><th>Signal</th><th><span class='vh'>Actions</span></th></tr></thead><tbody>${
            S.wl
              .map((w, i) => {
                const e = num(w.e),
                  p = wp(w),
                  d = e && p ? (((p - e) / e) * 100).toFixed(1) + "%" : "–",
                  s5 = sm(w),
                  dd = s5 && p ? ((p - s5) / s5) * 100 : null;
                const live = S.px && S.px[w.t] != null;
                return `<tr><td><b>${esc(w.t)}</b></td><td><select class='wsel' data-k='wdir' data-i='${i}' aria-label='Side ${esc(w.t)}'><option${w.dir !== "Short" ? " selected" : ""}>Long</option><option${w.dir === "Short" ? " selected" : ""}>Short</option></select></td><td><input class='wli' type='number' step='any' data-k='we' data-i='${i}' aria-label='Entry ${esc(w.t)}' value='${w.e ?? ""}'></td><td><input class='wli' type='number' step='any' data-k='ws' data-i='${i}' aria-label='Stop ${esc(w.t)}' value='${w.s ?? ""}'></td><td><input class='wli' type='number' step='any' data-k='wt' data-i='${i}' aria-label='Target ${esc(w.t)}' value='${w.tg ?? ""}' placeholder='–'></td><td>${live ? `<span class='wpx' title='${esc(tr("Live price"))}' data-nt>${$f(p, 2)}</span>` : `<input class='wli' type='number' step='any' data-k='wp' data-i='${i}' aria-label='Current price ${esc(w.t)}' value='${wp(w) ?? ""}' placeholder='${esc(tr("Type price"))}'>`}</td><td class='${e && p ? (p >= e ? "wup" : "wdn") : ""}'>${d}</td><td>${sig(w)}</td><td class='wact2'><button class='ib' data-a='wc' data-i='${i}' aria-label='${esc(tr("Send to calculator") + " " + w.t)}' title='${esc(tr("Send to calculator"))}'><svg width='18' height='18' viewBox='0 0 24 24' aria-hidden='true'><rect x='5' y='3' width='14' height='18' rx='3' fill='none' stroke='currentColor' stroke-width='2'/><path d='M8 7h8M8.5 12h1M12 12h0M15.5 12h0M8.5 16h1M12 16h0M15.5 16h0' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg></button><button class='ib ibd' data-a='wd' data-i='${i}' aria-label='${esc(tr("Delete") + " " + w.t)}' title='${esc(tr("Delete"))}'><svg width='18' height='18' viewBox='0 0 24 24' aria-hidden='true'><path d='M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg></button></td></tr>`;
              })
              .join("") ||
            `<tr><td colspan='9' class='mut' style='text-align:center'>Nothing on the watchlist yet. Add a stock above.</td></tr>`
          }</tbody></table></div>`
    }<p class='mut'><span>Prices load by themselves. If a price is missing, type it by hand. The signal compares the price with your planned entry and stop.</span> <span>${esc(pxMsg)}</span></p>`;
  }
  {
    const NM = navTabs().main,
      ix = NM.findIndex(t => t[0] === tab),
      pv = NM[ix - 1],
      nx = NM[ix + 1];
    if (ix >= 0)
      h += `<div class="stp">${pv ? `<button class="gh" data-t="${pv[0]}"><small class="ar">&larr;</small> <small>Back</small> <b>${pv[1]}</b></button>` : "<span></span>"}${nx ? `<button class="cta" data-t="${nx[0]}"><small>Next page</small> <b>${nx[1]}</b> <small class="ar">&rarr;</small></button>` : ""}</div>`;
  }
  $("v").innerHTML = h;
  hs();
  gamify();
  getPx();
  if (aplFrom && aplFrom !== tab && !lsRM() && $("v").animate) {
    const NM = navTabs().main.concat(navTabs().more),
      a = NM.findIndex(t => t[0] === aplFrom),
      b = NM.findIndex(t => t[0] === tab);
    let d = b >= a ? 1 : -1;
    if (document.documentElement.dir === "rtl") d = -d;
    $("v").animate(
      [
        { opacity: 0, transform: `translateX(${d * 18}px)` },
        { opacity: 1, transform: "none" }
      ],
      { duration: 300, easing: "cubic-bezier(.32,.72,0,1)" }
    );
  }
}
// The small P&L summary box at the top.
function hs() {
  const cl = S.trades.filter(t => t.x != null),
    P = cl.map(pnl),
    w = P.filter(x => x > 0).length;
  // Open trades count at the live price (11.11), like long-term holdings:
  // Trading P&L = closed trades + open trades now; Account and Invested are at market value.
  const q = S.trades.map(fl).filter(x => x != null),
    fl2 = q.length ? q.reduce((a, b) => a + b, 0) : null,
    net = P.reduce((a, b) => a + b, 0) + (fl2 || 0);
  const LT = ltD().h.length ? ltTot() : null,
    ltv = LT ? LT.val : 0,
    tA = acct() + (fl2 || 0) + (LT ? LT.pl : 0),
    tI = inv() + (fl2 || 0) + ltv;
  const ac = `<div class="hsa"><span>Account</span><b>${$f(tA)}</b></div><div><span>Invested</span><b>${$f(tI)} <small>${((tI / tA) * 100).toFixed(0)}%</small></b></div>${LT ? `<div><span>Long-term value</span><b>${$f(ltv)}</b></div>` : ""}<div><span>Free cash</span><b class="${cash() < 0 ? "neg" : ""}">${$f(cash())}</b></div>`;
  const tot = net + (LT ? LT.pl : 0),
    pc = (tot / (S.set.pf || 1)) * 100,
    cls = tot > 0 ? "pos" : tot < 0 ? "neg" : "",
    bk = LT
      ? `<div><span>Trading P&amp;L</span><b class="${net > 0 ? "pos" : net < 0 ? "neg" : ""}">${$f(net)}</b></div><div><span>Long-term P&amp;L</span><b class="${LT.pl > 0 ? "pos" : LT.pl < 0 ? "neg" : ""}">${$f(LT.pl)}</b></div>`
      : "";
  $("hs").innerHTML =
    S.trades.length || LT
      ? `<small>P&amp;L</small><b class="${cls}">${$f(tot)}</b><em class="${cls}">${(pc > 0 ? "+" : "") + pc.toFixed(2)}%</em>${bk}${ac}<div><span>Win rate</span><b>${cl.length ? Math.round((w / cl.length) * 100) + "%" : "–"}</b></div><div><span>Closed trades</span><b>${cl.length}</b></div><div><span>Open positions</span><b>${S.trades.length - cl.length}</b></div>${fl2 != null ? `<div><span>Open P&amp;L</span><b class="${fl2 > 0 ? "pos" : "neg"}">${$f(fl2)}</b></div>` : ""}`
      : `<small>P&amp;L</small><b>–</b><em>&nbsp;</em>${ac}<div><span>Win rate</span><b>–</b></div><div><span>Log a trade to start</span><b></b></div>`;
}
document.addEventListener("input", e => {
  const el = e.target,
    f = el.form;
  if (!f || f.id !== "tf") return;
  const v = n => num(f.elements[n].value),
    ent = v("e"),
    A = acct();
  if (el.name === "amt") {
    if (ent > 0 && v("amt") != null) f.elements.sh.value = +(v("amt") / ent).toFixed(4);
  } else if (el.name === "sh") {
    if (ent > 0 && v("sh") != null) f.elements.amt.value = +(v("sh") * ent).toFixed(2);
  } else if (el.name === "e") {
    if (ent > 0) {
      if (v("sh") != null) f.elements.amt.value = +(v("sh") * ent).toFixed(2);
      else if (v("amt") != null) f.elements.sh.value = +(v("amt") / ent).toFixed(4);
    }
  }
  const a = v("amt");
  $("amh").textContent =
    a > 0 && A > 0 ? "= " + ((a / A) * 100).toFixed(1) + "% of account" : "\u00a0";
});
// Show a tooltip for chart points.
const tp = e => {
  const r = e.target.closest && e.target.closest("[data-tip]"),
    o = $("ctip");
  if (r && o) o.textContent = r.dataset.tip;
};
document.addEventListener("mouseover", tp);
document.addEventListener("focusin", tp);
document.addEventListener("click", tp);
document.addEventListener(
  "toggle",
  e => {
    if (e.target.id === "ds") setOpen = e.target.open;
    else if (IMP && e.target.classList && e.target.classList.contains("imd"))
      IMP.mo = e.target.open;
  },
  true
);
document.addEventListener("click", e => {
  const b = e.target.closest("button"),
    n = e.target.closest("[data-n]");
  if (n) {
    openN = openN === n.dataset.n ? null : n.dataset.n;
    return view();
  }
  if (!b) return;
  if (b.dataset.t) {
    tab = b.dataset.t;
    view();
    window.scrollTo(0, 0);
    return;
  }
  const a = b.dataset.a,
    id = b.dataset.id;
  if (a === "nmore") {
    NAVM = !NAVM;
    return view();
  }
  if (a === "rp") {
    S.pulse = Array(QP().length).fill(null);
  } else if (a === "rs") {
    S.scr = { t: "", a: Array(QS().length).fill(null) };
  } else if (a === "tj") {
    const r = calc();
    S.trades.push({
      id: "t" + Date.now(),
      d: new Date().toISOString().slice(0, 10),
      t: tk(S.calc.t || S.scr.t),
      dir: S.calc.dir === "Short" ? "Short" : "Long",
      e: r.e,
      s: r.s,
      tg: r.tg,
      sh: r.sh,
      th: String(S.calc.th || "").slice(0, 2000),
      x: null
    });
    S.calc = { t: "", dir: "Long", e: "", s: "", tg: "" };
    S.pulse = Array(QP().length).fill(null);
    S.scr = { t: "", a: Array(QS().length).fill(null) };
    tab = "jr";
  } else if (a === "imno") {
    IMP = null;
    return view();
  } else if (a === "imok") {
    if (!IMP || !IMP.T) return;
    const b0 = Date.now();
    let nf = 0;
    if (IMP.mode === "sheet") {
      if (IMP.rows) sheetBuild();
      IMP.T.forEach((t, i) => {
        const { _pl, ...o } = t;
        S.trades.push({ ...o, id: "t" + b0 + "i" + i });
      });
      (IMP.F || []).forEach(([id, xd]) => {
        const t = S.trades.find(x => x.id === id);
        if (t && !t.xd) {
          t.xd = xd;
          nf++;
        }
      });
    } else
      IMP.T.forEach((t, i) =>
        S.trades.push({
          id: "t" + b0 + "i" + i,
          d: t.d,
          t: t.t,
          dir: t.dir,
          e: t.e,
          s: null,
          tg: null,
          sh: t.sh,
          m: null,
          th: "",
          x: t.x
        })
      );
    S.trades = S.trades.slice(0, 5000);
    const n = IMP.T.length;
    IMP = null;
    save();
    toast(
      LANG === "he"
        ? "יובאו " + n + " עסקאות" + (nf ? " · נוספו " + nf + " תאריכי יציאה" : "")
        : "Imported " + n + " trades" + (nf ? " · added " + nf + " exit dates" : "")
    );
    return view();
  } else if (a === "ct") {
    CT = ["c", "m"].includes(b.dataset.v) ? b.dataset.v : "l";
    try {
      localStorage.setItem("tj_chart", CT);
    } catch (e) {}
    return view();
  } else if (a === "ro") {
    if (!cf("Reopen this trade? The exit price, exit type and exit reason will be cleared."))
      return;
    const t = S.trades.find(t => t.id === id);
    if (t) {
      t.x = null;
      t.xd = "";
      t.rs = "";
      t.xr = "";
    }
  } else if (a === "dl") {
    if (!cf("Delete this trade?")) return;
    S.trades = S.trades.filter(t => t.id !== id);
  } else if (a === "cl") {
    clOpen(id);
    return;
  } else if (a === "wc") {
    const w = S.wl[+b.dataset.i];
    S.calc = { t: w.t, dir: w.dir || "Long", e: w.e ?? "", s: w.s ?? "", tg: w.tg ?? "" };
    tab = "calc";
  } else if (a === "wd") {
    S.wl.splice(+b.dataset.i, 1);
  } else if (a === "cta") {
    const n = ($("cn").value || "").trim().slice(0, 30),
      q = ($("cq").value || "").trim().slice(0, 200);
    if (!n || !q) {
      toast("Write the tool name and its question");
      return;
    }
    S.st.custom = S.st.custom || [];
    if (S.st.custom.length >= 10) {
      toast("Up to 10 tools of your own");
      return;
    }
    S.st.custom.push({ n, q });
  } else if (a === "jcols") {
    JALL = !JALL;
    try {
      localStorage.setItem("tj_jcols", JALL ? "all" : "few");
    } catch (e) {}
    return view();
  } else if (a === "jmore") {
    JN += 50;
    return view();
  } else if (a === "rsg") {
    const v = b.dataset.v || "";
    S.rules = S.rules || [];
    if (
      !RSUG.day.concat(RSUG.swing, RSUG.lt).includes(v) ||
      S.rules.length >= RMAX ||
      S.rules.some(r => r.t === tr(v))
    )
      return;
    S.rules.push({ id: "r" + Date.now().toString(36), t: tr(v) });
  } else if (a === "ra") {
    const el = $("rn"),
      v = ((el && el.value) || "").trim().slice(0, 200);
    S.rules = S.rules || [];
    if (!v || S.rules.length >= RMAX) return;
    S.rules.push({ id: "r" + Date.now().toString(36), t: v });
  } else if (a === "rdl") {
    if (!cf("Delete this rule? Trades that were marked with it will show “deleted rule”.")) return;
    (S.rules || []).splice(+id, 1);
  } else if (a === "trb") {
    const t = S.trades.find(x => x.id === id),
      r = b.dataset.r;
    if (!t) return;
    t.rb = t.rb || [];
    const j = t.rb.indexOf(r);
    if (j >= 0) t.rb.splice(j, 1);
    else if (t.rb.length < 10) t.rb.push(r);
  } else if (a === "ctr") {
    S.st.custom.splice(+id, 1);
  } else if (a === "stp") {
    if (!PRN[id]) return;
    S.prof = S.prof || [];
    const w = ltOnly(),
      j = S.prof.indexOf(id);
    if (j >= 0) S.prof.splice(j, 1);
    else S.prof.push(id);
    S.st.type = S.prof.find(p => STP[p]) || "";
    if (w !== ltOnly()) {
      if (!S.qp) fixA("pulse");
      if (!S.qs) fixA("scr");
    }
  } else if (a === "sty") {
    S.st.style = S.st.style === id ? "" : id;
  } else if (a === "stt") {
    const L = S.st.tools,
      j = L.indexOf(id);
    if (j >= 0) L.splice(j, 1);
    else L.push(id);
  } else if (a === "sb") {
    if (!S.st.type && !S.st.style && !S.st.tools.length && !(S.st.custom || []).length) {
      toast("Pick a trader type, a style or at least one tool first");
      return;
    }
    if ((S.qp || S.qs) && !cf("Replace your current questions with new ones?")) return;
    const dr = buildQ();
    if (dr > 0) {
      toast(
        "Only " + MAXQ + " screening questions fit, so " + dr + " of your choices were left out"
      );
    }
  } else if (a === "eq") {
    edq = id;
  } else if (a === "qx") {
    edq = null;
  } else if (a === "qd") {
    const L = qarr(id);
    if (L.length > 1) {
      L.splice(+b.dataset.i, 1);
      fixA(id);
    }
  } else if (a === "qa") {
    const L = qarr(id);
    if (L.length < 30) {
      L.push("New question");
      fixA(id);
    }
  } else if (a === "qr") {
    if (!cf("Restore the default questions?")) return;
    if (id === "pulse") S.qp = null;
    else S.qs = null;
    fixA(id);
  } else return;
  save();
  view();
});
document.addEventListener("change", e => {
  if (e.target.id === "imf") {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 6e6) {
      IMP = { err: "empty", name: f.name };
      view();
      return;
    }
    (/\.xlsx$/i.test(f.name)
      ? f
          .arrayBuffer()
          .then(xlsxRead)
          .then(SH => impSheets(f.name, SH))
      : /\.(xls|ods|numbers)$/i.test(f.name)
        ? Promise.reject(0)
        : f.text().then(tx => impMake(f, tx))
    )
      .then(() => view())
      .catch(() => {
        IMP = { err: /\.(xlsx|xls|ods|numbers)$/i.test(f.name) ? "fmt" : "empty", name: f.name };
        view();
      });
    e.target.value = "";
    return;
  }
  const el = e.target,
    k = el.dataset.k;
  if (el.dataset.im) {
    impEdit(el);
    view();
    return;
  }
  if (k) {
    const v = el.value,
      i = +el.dataset.i;
    if (k === "qe") {
      const L = qarr(el.dataset.id);
      L[i] = v.trim().slice(0, 200) || L[i];
    } else if (k === "pulse") {
      S.pulse[i] = v || null;
      S.pd = dkey(new Date());
      if (S.pulse.every(x => x)) {
        const dk = dkey(new Date());
        S.g = S.g || [];
        if (!S.g.includes(dk)) S.g = [...S.g, dk].slice(-400);
      }
    } else if (k === "scr") {
      S.scr.a[i] = v || null;
      S.scr.d = dkey(new Date());
    } else if (k === "st") {
      S.scr.t = v.toUpperCase();
      S.scr.d = dkey(new Date());
    } else if (k === "pf") S.set.pf = num(v) || 0;
    else if (k === "al") S.set.al = (num(v) || 0) / 100;
    else if (k === "mr") S.set.mr = (num(v) || 0) / 100;
    else if (k === "rr") S.set.rr = num(v) || 0;
    else if (k === "wp") S.wl[i].p = num(v);
    else if (k === "we") S.wl[i].e = num(v);
    else if (k === "ws") S.wl[i].s = num(v);
    else if (k === "wt") S.wl[i].tg = num(v);
    else if (k === "wdir") S.wl[i].dir = v === "Short" ? "Short" : "Long";
    else if (k === "wm") {
      const w = S.wl[i];
      w.m = num(v);
      if (S.sma) delete S.sma[w.t];
    } else if (k === "ct") S.calc.t = v.toUpperCase();
    else if (k === "cd") S.calc.dir = v;
    else if (k === "ce") S.calc.e = v;
    else if (k === "cs") S.calc.s = v;
    else if (k === "cg") S.calc.tg = v;
    else if (k === "cth") S.calc.th = v.slice(0, 2000);
    else if (k === "trk") {
      const t = S.trades.find(x => x.id === el.dataset.id);
      if (t) {
        t.rk = v === "y" || v === "n" ? v : "";
        if (t.rk !== "n") t.rb = [];
      }
    } else if (k === "rt") {
      const r = (S.rules || [])[i];
      if (r) {
        const x = v.trim().slice(0, 200);
        if (x) r.t = x;
      }
    } else if (k === "trs") {
      const t = S.trades.find(x => x.id === el.dataset.id);
      if (t) t.rs = rsN(v);
    } else if (k === "txr") {
      const t = S.trades.find(x => x.id === el.dataset.id);
      if (t) t.xr = v.slice(0, 2000);
    } else if (k === "tth") {
      const t = S.trades.find(x => x.id === el.dataset.id);
      if (t) t.th = v.slice(0, 2000);
    } else if (k === "ca") S.calc.amt = v;
    else if (k === "cn") S.calc.shs = v;
    else if (/^t(e|s|g|sh|x|dt|xd)$/.test(k)) {
      const t = S.trades.find(x => x.id === el.dataset.id);
      if (t) {
        const n = num(v);
        if (k === "tdt") {
          if (/^\d{4}-\d{2}-\d{2}$/.test(v)) t.d = v;
        } else if (k === "txd") {
          if (/^\d{4}-\d{2}-\d{2}$/.test(v)) t.xd = v;
        } else if (k === "te") {
          if (n > 0) t.e = n;
        } else if (k === "tsh") {
          if (n > 0) t.sh = n;
        } else if (k === "tx") {
          if (n > 0) t.x = n;
        } else if (k === "ts") t.s = n > 0 ? n : null;
        else if (k === "tg") t.tg = n > 0 ? n : null;
      }
    }
    save();
    if (k !== "cth" && k !== "tth" && k !== "txr") view();
  }
});
document.addEventListener("submit", e => {
  if (e.target.id !== "tf") return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(e.target));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.d || "")) return;
  if (!tk(v.t)) return;
  S.trades.push({
    id: "t" + Date.now(),
    d: v.d,
    t: tk(v.t),
    dir: v.dir === "Short" ? "Short" : "Long",
    e: num(v.e),
    s: num(v.s),
    tg: num(v.tg),
    sh: num(v.sh),
    m: num(v.m),
    th: v.th,
    x: null
  });
  // The screening is finished once the stock is in the journal.
  if (scrDone()) scrNew();
  save();
  view();
});
document.addEventListener("submit", e => {
  if (e.target.id !== "wf") return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(e.target));
  if (!tk(v.t)) return;
  S.wl.push({
    t: tk(v.t),
    dir: v.dir === "Short" ? "Short" : "Long",
    e: num(v.e),
    s: num(v.s),
    tg: num(v.tg),
    p: num(v.p)
  });
  // The screening is finished once the stock is on the watchlist.
  if (scrDone()) scrNew();
  save();
  view();
});
