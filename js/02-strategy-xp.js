/*
 * 02-strategy-xp.js — part of the TradeInk app script.
 *
 * Strategy page and gamification (XP, levels, streak, badges).
 * - buildQ() turns the chosen style + tools into the Daily pulse / Stock screening questions.
 * - gx() / gamify() compute XP, level and badges and update the level pill.
 * - strPage() renders the Strategy tab.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Last shown XP and level (to spot a level-up), and the toast timer.
let lastXP = null,
  lastL = null,
  tmT;
// Show a short message at the bottom of the screen.
function toast(m) {
  const e = $("toast");
  e.textContent = m;
  e.classList.add("on");
  clearTimeout(tmT);
  tmT = setTimeout(() => e.classList.remove("on"), 2800);
}
// Most questions allowed in one list.
const MAXQ = 9;
// Build the Daily pulse and Stock screening questions from the chosen style and tools.
function buildQ() {
  const st = S.st,
    D = st.type === "day",
    TS = toolsFor(st.type),
    stop = "A logical stop-loss level can be set in advance?",
    pq = [PQ[0]];
  const head = [];
  if (D)
    head.push(
      "Is the stock liquid enough for day trading (at least 1 million shares changing hands daily, tight spread)?"
    );
  const sty = D ? STQD : STQ;
  if (st.style && sty[st.style]) head.push(sty[st.style]);
  if (D)
    pq.push(
      "Have I marked today's key levels and prepared my watchlist before the open?",
      "Have I decided the maximum number of trades I will take today?"
    );
  const tq = [];
  st.tools
    .filter(k => TS[k])
    .forEach(k => {
      const dd = D && TLD[k],
        sc = dd ? dd[0] : TS[k][1],
        pu = dd && TS[k][2] && dd[1] ? dd[1] : TS[k][2];
      if (sc) tq.push(sc);
      if (pu) pq.push(pu);
    });
  const cu = (st.custom || []).map(c => c.q);
  let room = MAXQ - 1 - head.length;
  const cuK = cu.slice(0, Math.max(0, room));
  room -= cuK.length;
  const tqK = tq.slice(0, Math.max(0, room));
  S.qs = [...new Set([...head, ...tqK, ...cuK, stop])];
  S.qp = [...new Set([...pq, PQ[PQ.length - 2], PQ[PQ.length - 1]])];
  fixA("pulse");
  fixA("scr");
  return tq.length + cu.length - tqK.length - cuK.length;
}
// A date as "YYYY-MM-DD" (local time).
const dkey = d =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");
// How many days in a row the user did the Daily pulse.
function streak() {
  const D = S.g || [];
  let n = 0,
    first = true;
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) {
      if (D.includes(dkey(d))) n++;
      else if (!first) break;
      first = false;
    }
    d.setDate(d.getDate() - 1);
  }
  return n;
}
// Compute XP, level and badges from what the user has done.
function gx() {
  const T = S.trades,
    wl = S.wl.length,
    tr = T.length,
    rs = T.filter(t => t.th).length,
    cl = T.filter(t => t.x != null),
    xr = cl.filter(t => t.xr).length,
    xt = cl.filter(t => t.rs).length,
    sp = T.filter(t => t.s != null).length,
    days = (S.g || []).length,
    str = streak();
  const built = !!(S.qp || S.qs),
    xp = tr * 10 + rs * 10 + xr * 10 + xt * 5 + sp * 5 + wl * 2 + days * 15 + (built ? 25 : 0),
    L = 1 + Math.floor(Math.sqrt(xp / 40));
  const B = [
    ["first", "First step", "Log your first trade", tr >= 1],
    ["ten", "Ten logged", "Log 10 trades", tr >= 10],
    ["why5", "Reason writer", "Write the reason for 5 entries", rs >= 5],
    ["exit", "Honest exit", "Write a reason for an exit", xr >= 1],
    ["stop10", "Risk manager", "Set a stop on 10 trades", sp >= 10],
    ["str3", "On a roll", "Daily pulse 3 trading days in a row", str >= 3],
    ["pul5", "Disciplined", "Complete the Daily pulse on 5 days", days >= 5],
    ["scout", "Scout", "Add 10 stocks to the watchlist", wl >= 10],
    ["plan", "Strategist", "Build or edit your own questions", built]
  ];
  return { xp, L, lo: 40 * (L - 1) ** 2, hi: 40 * L * L, B, str, days };
}
// Update the level pill and celebrate a new level or badge.
function gamify() {
  const g = gx();
  $("lv").textContent = "Lv " + g.L + " · " + g.xp + " XP";
  const got = g.B.filter(b => b[3]).map(b => b[0]),
    prev = lastXP,
    pl = lastL;
  lastXP = g.xp;
  lastL = g.L;
  if (prev == null || !Array.isArray(S.bd)) {
    S.bd = got;
    return;
  }
  const nw = g.B.filter(b => b[3] && !S.bd.includes(b[0])),
    m = [];
  if (g.xp > prev) m.push("+" + (g.xp - prev) + " XP");
  if (g.L > pl) m.push("Level " + g.L + ": " + TT[Math.min(g.L - 1, TT.length - 1)] + "!");
  if (nw.length) m.push("Badge: " + nw[0][1]);
  if (nw.length) {
    S.bd = got;
    save();
  }
  if (m.length) toast(m.join(" · "));
}
// The progress card (level bar and badges).
function pcard() {
  const g = gx(),
    pc = Math.max(0, Math.min(100, ((g.xp - g.lo) / (g.hi - g.lo)) * 100));
  return `<div class="card" style="margin-top:12px"><h2>Your progress</h2><div class="pl"><span class="big">Level ${g.L} · ${TT[Math.min(g.L - 1, TT.length - 1)]}</span><span>${g.xp} XP</span><span>Streak: <b>${g.str}</b> trading day${g.str === 1 ? "" : "s"}</span></div><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pc)}"><i style="width:${pc}%"></i></div><small class="mut">${g.hi - g.xp} XP to level ${g.L + 1}. XP are experience points: you earn them for good habits, and they raise your level. Earn XP by logging trades, writing your reasons, setting stops and completing the Daily pulse.</small><details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">How XP works</summary><table style="margin-top:8px;max-width:420px"><tbody><tr><td>Trade logged</td><td>+10</td></tr><tr><td>Reason for entry written</td><td>+10</td></tr><tr><td>Reason for exit written</td><td>+10</td></tr><tr><td>Exit type chosen</td><td>+5</td></tr><tr><td>Stop-loss set</td><td>+5</td></tr><tr><td>Stock on the watchlist</td><td>+2</td></tr><tr><td>Day with a completed Daily pulse</td><td>+15</td></tr><tr><td>Building your own questions (once)</td><td>+25</td></tr></tbody></table><p class="mut" style="margin:8px 0 0">Level 2 needs 40 XP, level 3 needs 160, level 4 needs 360, and so on.</p></details><div class="bdg">${g.B.map(b => `<div class="bg${b[3] ? " on" : ""}"><b>${b[3] ? "★" : "☆"} ${b[1]}</b>${b[2]}</div>`).join("")}</div></div>`;
}
// HTML of the Strategy tab.
function strPage() {
  const st = S.st;
  return (
    `<div class="card"><h2>Your strategy</h2><p class="mut">Tell us how you trade and which tools you use. We build your Daily pulse and Stock screening questions from your choices, and you can edit every question afterwards.</p>
<p style="margin:16px 0 4px;font-weight:600">Who are you? Pick one or more.</p><p class="mut" style="margin:0 0 6px;font-size:13.5px">The site arranges its tabs and dashboard for you. Nothing is deleted when you change this.</p><div class="chips">${Object.entries(
      PRN
    )
      .map(([k, v]) => {
        const on = (S.prof || []).includes(k);
        return `<button class="chip${on ? " on" : ""}" data-a="stp" data-id="${k}" aria-pressed="${on}">${v}</button>`;
      })
      .join("")}</div>
<p style="margin:16px 0 4px;font-weight:600">How do you trade?</p><div class="chips">${Object.entries(
      STY
    )
      .map(
        ([k, v]) =>
          `<button class="chip${st.style === k ? " on" : ""}" data-a="sty" data-id="${k}" aria-pressed="${st.style === k}">${v}</button>`
      )
      .join("")}</div>
<p style="margin:16px 0 4px;font-weight:600">Which tools do you use?</p><p class="mut" style="margin:0 0 6px;font-size:13.5px">Pick the ones that matter most. Stock screening is kept to 9 questions, and tools are used in the order you pick them.</p><div class="chips">${Object.entries(
      toolsFor(st.type)
    )
      .map(
        ([k, v]) =>
          `<button class="chip${st.tools.includes(k) ? " on" : ""}" data-a="stt" data-id="${k}" aria-pressed="${st.tools.includes(k)}">${v[0]}</button>`
      )
      .join(
        ""
      )}${(st.custom || []).map((c, i) => `<button class="chip on" data-a="ctr" data-id="${i}" aria-label="Remove ${esc(c.n)}">${esc(c.n)} ✕</button>`).join("")}</div>
<p style="margin:16px 0 4px;font-weight:600">Add your own tool</p><div class="f cus" style="grid-template-columns:minmax(140px,1fr) minmax(220px,3fr) auto;align-items:end"><label>Tool name<input id="cn" maxlength="30" placeholder="For example: Anchored VWAP"></label><label>Question to ask yourself (answer Yes or No)<input id="cq" maxlength="200" placeholder="For example: Is the price holding above the anchored VWAP?"></label><div><button class="gh" data-a="cta">Add tool</button></div></div>
<p style="margin-top:18px"><button class="cta" data-a="sb">Build my questions</button></p>${S.qp || S.qs ? `<p class="mut">Your questions are ready. Review or edit them: <button class="gh sm" data-t="pulse">Daily pulse</button> <button class="gh sm" data-t="scr">Stock screening</button></p>` : ""}</div>` +
    rulesCard() +
    pcard()
  );
}
