/*
 * 14-coach.js — part of the Trading.Journal app script.
 *
 * The AI coach.
 * - Talks to our server (CO_URL, on Cloudflare), which checks the login and asks the AI.
 * - Daily limits: CO_MAX (messages and chart images per day).
 * - coCtx(): what the coach is allowed to see (chips the user can turn off).
 * - coMock(): offline answer used for testing.
 * - coFmt(): makes the coach's answer safe for HTML (escape first, then **bold**).
 * - coRender(): draws the chat window. The block at the end adds the coach's CSS and
 *   the floating button, and makes view() also refresh the coach.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

/* AI coach (draft). To undo: remove this block and the two "Ask coach" buttons in the journal. Design: project doc design/ai-coach-design-handoff.md */
// Our coach server on Cloudflare.
const CO_URL =
  "https://trading-coach.dikmanguy1.workers.dev"; /* Cloudflare Worker (code in worker/). Empty = demo answers built by fixed rules, nothing is sent */
// Daily limits and chart image limits (size, type).
const CO_MAX = { m: 20, i: 5 },
  CO_SIDE = 1568,
  CO_BYTES = 2e6,
  CO_TYPES = ["image/png", "image/jpeg", "image/webp"];
// Coach window state.
let coOpen = false,
  coMsgs = [],
  coBusy = false,
  coImg = null,
  coScope = "d30",
  coTid = null,
  coErr = "",
  coGen = 0,
  coOff = {};
// Today's date key.
const coDay = () => dkey(new Date());
// Today's usage on this device.
function coUse() {
  try {
    const u = JSON.parse(localStorage.getItem("tj_co_use") || "{}");
    if (u && u.d === coDay()) return u;
  } catch (e) {}
  return { d: coDay(), m: 0, i: 0 };
}
// Count one message (and one image).
function coBump(img) {
  const u = coUse();
  u.m++;
  if (img) u.i++;
  try {
    localStorage.setItem("tj_co_use", JSON.stringify(u));
  } catch (e) {}
}
// The user accepted the coach notice.
function coOk() {
  try {
    return localStorage.getItem("tj_co_ok") === "1";
  } catch (e) {
    return false;
  }
}
// Cut text to n characters.
const coCut = (s, n) => String(s || "").slice(0, n);
// Daily pulse done today.
const coPulseDone = () => Array.isArray(S.g) && S.g.includes(coDay());
// The greeting was already shown today.
function coSeen() {
  try {
    return localStorage.getItem("tj_co_seen") === coDay();
  } catch (e) {
    return true;
  }
}
/* Mascot (inline SVG). Wicks, arms and sparkles use currentColor so they follow the background. */
// The coach character (SVG) for a mood.
function coAv(m, h) {
  const sm = h < 40,
    ti = h <= 28,
    I = "#1c1f26",
    w = sm ? 9 : 6,
    ck = o =>
      sm
        ? ""
        : `<ellipse cx="37" cy="86" rx="7" ry="4.5" fill="#ff9f43" opacity="${o}"/><ellipse cx="83" cy="86" rx="7" ry="4.5" fill="#ff9f43" opacity="${o}"/>`;
  const arcs = `<path d="M39 70q7-9 14 0M67 70q7-9 14 0" fill="none" stroke="${I}" stroke-width="${sm ? 6.75 : 4.5}" stroke-linecap="round"/>`;
  let s = `<svg viewBox="0 0 120 150" width="${Math.round(h * 0.8)}" height="${h}" aria-hidden="true" focusable="false">`;
  if (m === "celebrating")
    s += `<path d="M24 78L9 60M96 78l15-18" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/>`;
  s += `<path d="M60 6v22M60 122v22" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/><rect x="22" y="26" width="76" height="96" rx="28" fill="#B8A4FF"/>`;
  if (m === "pleased")
    s +=
      ck(0.7) +
      arcs +
      (ti
        ? ""
        : `<path d="M48 85q12 16 24 0z" fill="${I}" stroke="${I}" stroke-width="3" stroke-linejoin="round"/>`);
  else if (m === "concerned")
    s +=
      `<path d="M38 59l14-5M82 59l-14-5" fill="none" stroke="${I}" stroke-width="${sm ? 6 : 4}" stroke-linecap="round"/><circle cx="46" cy="70" r="${sm ? 8 : 5.5}" fill="${I}"/><circle cx="74" cy="70" r="${sm ? 8 : 5.5}" fill="${I}"/>` +
      (ti
        ? ""
        : `<path d="M48 92q6-5 12 0t12 0" fill="none" stroke="${I}" stroke-width="${sm ? 6 : 4}" stroke-linecap="round"/>`);
  else if (m === "celebrating")
    s +=
      ck(0.7) +
      arcs +
      (ti ? "" : `<ellipse cx="60" cy="91" rx="9" ry="8" fill="${I}"/>`) +
      `<path d="M12 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM106 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="currentColor"/>`;
  else if (m === "sad")
    s +=
      `<path d="M38 61l13-4M82 61l-13-4" fill="none" stroke="${I}" stroke-width="${sm ? 6 : 3.5}" stroke-linecap="round"/><circle cx="46" cy="70" r="${sm ? 8 : 6}" fill="${I}"/><circle cx="74" cy="70" r="${sm ? 8 : 6}" fill="${I}"/>` +
      (ti
        ? ""
        : `<path d="M48 95q12-11 24 0" fill="none" stroke="${I}" stroke-width="${sm ? 6 : 4}" stroke-linecap="round"/>`) +
      (sm ? "" : `<path d="M40 78q-3 5 0 7q3-2 0-7z" fill="#5ac8fa"/>`);
  else if (m === "neutral")
    s +=
      ck(0.35) +
      `<circle cx="46" cy="68" r="${sm ? 8 : 6.5}" fill="${I}"/><circle cx="74" cy="68" r="${sm ? 8 : 6.5}" fill="${I}"/>` +
      (ti
        ? ""
        : `<path d="M50 90h20" fill="none" stroke="${I}" stroke-width="${sm ? 6 : 4}" stroke-linecap="round"/>`);
  else
    s +=
      ck(0.55) +
      `<circle cx="46" cy="68" r="${sm ? 8 : 6.5}" fill="${I}"/><circle cx="74" cy="68" r="${sm ? 8 : 6.5}" fill="${I}"/>` +
      (sm
        ? ""
        : `<circle cx="48.3" cy="65.6" r="2.2" fill="#fff"/><circle cx="76.3" cy="65.6" r="2.2" fill="#fff"/>`) +
      (ti
        ? ""
        : `<path d="M50 88q10 8 20 0" fill="none" stroke="${I}" stroke-width="${sm ? 6 : 4}" stroke-linecap="round"/>`);
  return s + `</svg>`;
}
/* Market mood: the coach's face follows the S&P 500 (SPY) day. Green = smile, red = sad, about flat = neutral. */
// Market move today (SPY), for the coach's mood.
let coMk = null;
// Below this % the market counts as flat.
const CO_FLAT = 0.15;
// Coach mood from the market.
const coMkMood = () =>
  coMk == null ? "calm" : coMk > CO_FLAT ? "pleased" : coMk < -CO_FLAT ? "sad" : "neutral";
// Accessible label of the coach button.
function coMkLabel() {
  const he = LANG === "he",
    base = he ? "פתיחת הצ'אט עם המאמן" : "Open coach chat";
  if (coMk == null) return base;
  const v = (coMk > 0 ? "+" : "") + coMk.toFixed(2) + "%";
  return base + (he ? ". S&P 500 ביום המסחר האחרון: " : ". S&P 500 last session: ") + v;
}
// Update the coach button for the market mood.
function coMkApply() {
  const b = $("cob");
  if (b) {
    b.innerHTML = coAv(coMkMood(), 39);
    b.setAttribute("aria-label", coMkLabel());
    b.title = coMkLabel();
  }
  const h = document.querySelector(".cohav");
  if (h) h.innerHTML = coAv(coMkMood(), 34);
}
// Load today's SPY move from Finnhub.
async function coMkLoad() {
  if (!FK || S.keyBad) return;
  try {
    const r = await fetch(
      "https://finnhub.io/api/v1/quote?symbol=SPY&token=" + encodeURIComponent(FK)
    );
    if (!r.ok) return;
    const d = await r.json();
    if (d && typeof d.dp === "number" && isFinite(d.dp)) {
      coMk = d.dp;
      coMkApply();
    }
  } catch (e) {}
}
/* What the coach sees */
// Trades the coach can see (by the chosen range).
function coTrades() {
  if (coOff.tr) return [];
  const all = S.trades.slice().sort((a, b) => (a.d < b.d ? 1 : -1));
  if (coScope === "t") {
    const t = all.find(x => x.id === coTid);
    return t ? [t] : [];
  }
  if (coScope === "n10") return all.slice(0, 10);
  if (coScope === "all") return all.slice(0, 50);
  const c = new Date();
  c.setDate(c.getDate() - 30);
  const k = dkey(c);
  return all.filter(t => t.d >= k).slice(0, 50);
}
// Risk of a trade as % of the account.
const coRiskPct = t => {
  const r = risk(t),
    a = acct();
  return r == null || !(a > 0) ? null : r / a;
};
// Did a trade break the risk settings.
const coBreaks = t =>
  t.s == null ||
  (rr(t) != null && S.set.rr && rr(t) < S.set.rr) ||
  (S.set.mr && coRiskPct(t) != null && coRiskPct(t) > S.set.mr + 1e-9);
// Summary numbers for the coach.
function coStats(L) {
  const C = L.filter(t => t.x != null),
    W = C.filter(t => pnl(t) > 0),
    Lo = C.filter(t => pnl(t) < 0);
  const early = W.filter(t => t.tg != null && (t.dir === "Short" ? t.x > t.tg : t.x < t.tg));
  const past = Lo.filter(t => t.s != null && (t.dir === "Short" ? t.x > t.s : t.x < t.s));
  const noStop = L.filter(t => t.s == null),
    noWhy = L.filter(t => !String(t.th || "").trim());
  const lowRR = S.set.rr ? L.filter(t => rr(t) != null && rr(t) < S.set.rr) : [];
  const bigRisk = S.set.mr
    ? L.filter(t => coRiskPct(t) != null && coRiskPct(t) > S.set.mr + 1e-9)
    : [];
  const path = early.map(t => (t.x - t.e) / (t.tg - t.e)).filter(v => isFinite(v));
  const tk = a => a.map(t => t.t).slice(0, 10);
  return {
    trades: L.length,
    closed: C.length,
    wins: W.length,
    losses: Lo.length,
    earlyExits: early.length,
    earlyAvgPctOfTarget: path.length
      ? Math.round((path.reduce((a, b) => a + b, 0) / path.length) * 100)
      : null,
    exitPastStop: past.length,
    noStop: noStop.length,
    noReason: noWhy.length,
    belowMinRR: lowRR.length,
    aboveMaxRisk: bigRisk.length,
    tickers: {
      earlyExits: tk(early),
      exitPastStop: tk(past),
      noStop: tk(noStop),
      belowMinRR: tk(lowRR),
      aboveMaxRisk: tk(bigRisk)
    }
  };
}
// Everything sent to the coach with a question.
function coCtx() {
  const L = coTrades(),
    st = S.st,
    tl = toolsFor(st.type),
    o = {};
  if (!coOff.st)
    o.strategy = {
      type: STP[st.type] || "",
      style: STY[st.style] || "",
      tools: st.tools
        .map(k => (tl[k] || [k])[0])
        .concat((st.custom || []).map(c => c.n || ""))
        .filter(Boolean)
    };
  if (!coOff.rk)
    o.rules = {
      minRR: S.set.rr || null,
      maxRiskPct: S.set.mr ? +(S.set.mr * 100).toFixed(2) : null,
      account: Math.round(acct())
    };
  if (!coOff.pl)
    o.dailyPulseToday = {
      done: coPulseDone(),
      answers: QP().map((q, i) => ({ q, a: S.pulse[i] || null }))
    };
  if (!coOff.tr) {
    o.trades = L.map(t => ({
      date: t.d,
      exitDate: t.xd || null,
      ticker: t.t,
      side: t.dir,
      entry: t.e,
      stop: t.s,
      target: t.tg,
      shares: t.sh,
      exit: t.x,
      reason: coCut(t.th, 500),
      exitReason: coCut(t.xr, 500)
    }));
    o.stats = coStats(L);
  }
  return o;
}
// Coach mood from the trades.
const coMood = L => (L.some(coBreaks) ? "concerned" : L.length ? "pleased" : "calm");
/* Demo answer: fixed rules over the user's own trades. Replaced by the server's answer once CO_URL is set. */
// Offline test answer.
function coMock(hasImg) {
  const L = coTrades(),
    s = coStats(L),
    H = LANG === "he",
    out = [],
    b = [],
    nE = n => (n === 1 ? "1 trade" : n + " trades"),
    nH = n => (n === 1 ? "עסקה אחת" : n + " עסקאות"),
    hv = n => (n === 1 ? "has" : "have");
  if (coOff.tr)
    return H
      ? 'הורדת את העסקאות משורת "המאמן רואה", אז אין לי מה לבדוק. החזר אותן כדי שאבדוק.'
      : 'You removed trades from "Coach sees", so there is nothing for me to check. Add them back and ask again.';
  if (!s.trades)
    return H
      ? 'אין עסקאות בטווח שנבחר. בחר טווח אחר בשורת "המאמן רואה", או הוסף עסקאות ליומן.'
      : 'There are no trades in the selected range. Pick another range in "Coach sees", or log some trades.';
  out.push(
    H
      ? `בדקתי ${nH(s.trades)} (${s.closed} סגורות).`
      : `I checked ${nE(s.trades)} (${s.closed} closed).`
  );
  const p = s.earlyAvgPctOfTarget,
    mr = S.set.mr ? +(S.set.mr * 100).toFixed(2) : null;
  if (s.earlyExits)
    b.push(
      H
        ? `ב-${s.earlyExits} מתוך ${s.wins} העסקאות המרוויחות יצאת **לפני היעד**${p != null ? ` (בממוצע ${p}% מהדרך ליעד)` : ""}.`
        : `In ${s.earlyExits} of ${s.wins} winning trades you exited **before the target**${p != null ? ` (on average ${p}% of the way)` : ""}.`
    );
  if (s.exitPastStop)
    b.push(
      H
        ? `ב-${s.exitPastStop} מתוך ${s.losses} העסקאות המפסידות יצאת **מעבר לסטופ** שהגדרת.`
        : `In ${s.exitPastStop} of ${s.losses} losing trades you exited **beyond the stop** you set.`
    );
  if (s.noStop)
    b.push(H ? `${nH(s.noStop)} **בלי סטופ**.` : `${nE(s.noStop)} ${hv(s.noStop)} **no stop**.`);
  if (s.aboveMaxRisk)
    b.push(
      H
        ? `${s.aboveMaxRisk === 1 ? "בעסקה אחת" : "ב-" + s.aboveMaxRisk + " עסקאות"} הסיכון **גבוה מ-${mr}%** מהחשבון שהגדרת.`
        : `${nE(s.aboveMaxRisk)} ${s.aboveMaxRisk === 1 ? "risks" : "risk"} **more than the ${mr}%** of your account you set.`
    );
  if (s.belowMinRR)
    b.push(
      H
        ? `${s.belowMinRR === 1 ? "בעסקה אחת" : "ב-" + s.belowMinRR + " עסקאות"} יחס הסיכון/סיכוי **נמוך מ-1:${S.set.rr}** שהגדרת.`
        : `${nE(s.belowMinRR)} ${hv(s.belowMinRR)} a risk/reward **below the 1:${S.set.rr}** you set.`
    );
  if (s.noReason)
    b.push(
      H
        ? `${nH(s.noReason)} **בלי סיבת כניסה** כתובה.`
        : `${nE(s.noReason)} ${hv(s.noReason)} **no written reason** for entry.`
    );
  if (!b.length)
    b.push(
      H
        ? "לא מצאתי חריגות מהכללים שאני יודע לבדוק כרגע."
        : "I found no breaks of the rules I can check right now."
    );
  out.push(b.map(x => "- " + x).join("\n"));
  if (hasImg)
    out.push(
      H
        ? "ניתוח של תמונת הגרף יעבוד אחרי החיבור לשרת."
        : "Reading the chart image will work once the server is connected."
    );
  const q = s.earlyExits
    ? H
      ? "מה גרם לך לצאת לפני היעד?"
      : "What made you exit before the target?"
    : s.exitPastStop
      ? H
        ? "מה עצר אותך מלצאת בסטופ?"
        : "What stopped you from exiting at your stop?"
      : s.noStop
        ? H
          ? "איפה הסטופ היה צריך להיות לפי הכלל שלך?"
          : "Where should the stop have been by your own rule?"
        : H
          ? "איזה כלל תרצה שאבדוק בפעם הבאה?"
          : "Which rule should I check next time?";
  out.push((H ? "**שאלה לחשוב עליה:** " : "**Something to think about:** ") + q);
  return out.join("\n\n");
}
// Send a question to the coach server (with the login token).
async function coApi(q, img, hist) {
  if (!U) throw new Error("Log in to use the coach.");
  const tok = await U.getIdToken();
  const ctl = new AbortController(),
    tm = setTimeout(() => ctl.abort(), 45000);
  let r;
  try {
    r = await fetch(CO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
      signal: ctl.signal,
      body: JSON.stringify({
        q: q.slice(0, 1000),
        lang: LANG,
        ctx: coCtx(),
        hist,
        img: img ? { mime: img.mime, data: img.url.split(",")[1] } : null
      })
    });
  } catch (e) {
    throw new Error(
      e && e.name === "AbortError"
        ? "The coach took too long. Try again."
        : "Could not reach the coach. Check your connection and try again."
    );
  } finally {
    clearTimeout(tm);
  }
  if (r.status === 401 || r.status === 403)
    throw new Error("The coach is not available for this account.");
  if (r.status === 429) throw new Error("You reached today's limit. Try again tomorrow.");
  if (r.status === 413) throw new Error("That image is too large. Use a smaller screenshot.");
  if (!r.ok) throw new Error("The coach could not answer right now. Try again later.");
  let d;
  try {
    d = await r.json();
  } catch (e) {
    d = null;
  }
  if (!d || typeof d.a !== "string" || !d.a.trim())
    throw new Error("The coach could not answer right now. Try again later.");
  if (d.left && isFinite(d.left.m) && isFinite(d.left.i)) {
    try {
      localStorage.setItem(
        "tj_co_use",
        JSON.stringify({
          d: coDay(),
          m: CO_MAX.m - d.left.m - 1,
          i: CO_MAX.i - d.left.i - (img ? 1 : 0)
        })
      );
    } catch (e) {}
  }
  return d.a.slice(0, 6000);
}
// Send the typed question.
async function coSend() {
  if (coBusy) return;
  const ta = $("coq"),
    q = (ta ? ta.value : "").trim();
  if (!q && !coImg) return;
  const u = coUse();
  if (u.m >= CO_MAX.m) {
    coErr = "You reached today's message limit. Try again tomorrow.";
    return coRender();
  }
  if (coImg && u.i >= CO_MAX.i) {
    coErr = "You reached today's image limit. Try again tomorrow.";
    return coRender();
  }
  const img = coImg,
    g = coGen,
    L = coTrades(),
    hist = coMsgs
      .filter(m => !m.local)
      .slice(-6)
      .map(m => ({
        role: m.r === "u" ? "user" : "coach",
        text: coCut(m.r === "u" ? m.q : m.a, 1500)
      }));
  coMsgs.push({ r: "u", q, img: img && img.url });
  if (ta) ta.value = "";
  coImg = null;
  coErr = "";
  coBusy = true;
  coRender();
  let a = null,
    demo = false,
    err = "";
  try {
    if (!CO_URL) {
      await pause(600);
      a = coMock(!!img);
      demo = true;
    } else a = await coApi(q, img, hist);
    coBump(!!img);
  } catch (e) {
    err = (e && e.message) || "The coach could not answer right now. Try again later.";
  }
  if (g !== coGen) return;
  coBusy = false;
  if (a != null) {
    const one = coScope === "t" && L.length === 1 && coBreaks(L[0]) ? L[0].id : null;
    coMsgs.push({ r: "a", a, demo, mood: coOff.tr ? "calm" : coMood(L), calc: one });
  } else coErr = err;
  coRender();
}
// Attach a chart image (resized, checked).
async function coPick(f) {
  coErr = "";
  if (!f) return coRender();
  if (!CO_TYPES.includes(f.type)) {
    coErr = "Use a PNG, JPEG or WebP image.";
    return coRender();
  }
  if (f.size > 15e6) {
    coErr = "That image is too large. Use a smaller screenshot.";
    return coRender();
  }
  try {
    const url0 = await new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = no;
      r.readAsDataURL(f);
    });
    const im = await new Promise((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = no;
      i.src = url0;
    });
    const k = Math.min(1, CO_SIDE / Math.max(im.naturalWidth, im.naturalHeight)),
      c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(im.naturalWidth * k));
    c.height = Math.max(1, Math.round(im.naturalHeight * k));
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(im, 0, 0, c.width, c.height);
    let q = 0.85,
      url = c.toDataURL("image/jpeg", q);
    while (url.length * 0.75 > CO_BYTES && q > 0.4) {
      q -= 0.15;
      url = c.toDataURL("image/jpeg", q);
    }
    if (url.length * 0.75 > CO_BYTES) {
      coErr = "That image is too large. Use a smaller screenshot.";
      return coRender();
    }
    coImg = {
      url,
      mime: "image/jpeg",
      name: coCut(f.name || "chart", 60),
      size: Math.round(url.length * 0.75)
    };
  } catch (e) {
    coErr = "Could not read that image. Try another file.";
  }
  coRender();
  const t = $("coq");
  if (t) t.focus();
}
// Coach answer to safe HTML (escape first, then **bold** and line breaks).
function coFmt(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split(/\n{2,}/)
    .map(p => {
      const L = p.split("\n").filter(l => l.trim());
      if (!L.length) return "";
      if (L.every(l => /^\s*[-•*]\s/.test(l)))
        return (
          "<ul>" + L.map(l => "<li>" + l.replace(/^\s*[-•*]\s/, "") + "</li>").join("") + "</ul>"
        );
      return "<p>" + L.join("<br>") + "</p>";
    })
    .join("");
}
// Small icons.
const CO_SVG = {
  x: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  im: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 9"/></svg>',
  go: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'
};
// The coach disclaimer.
const CO_DIS =
  "A helper tool only, not investment advice."; /* final wording comes from the legal agent */
// One chat bubble.
function coBubble(m) {
  if (m.r === "u")
    return `<div class="comsg cou">${m.img ? `<img src="${m.img}" alt="${esc(tr("Chart you uploaded"))}">` : ""}${m.q ? `<p data-nt>${esc(m.q)}</p>` : ""}</div>`;
  return `<div class="comsg coa"><span class="coav">${coAv(m.mood || "calm", 30)}</span><div class="coaw"><div class="cob2"><div${m.local ? "" : " data-nt"}>${m.local ? m.a : coFmt(m.a)}</div>${m.demo ? `<p class="codemo">Demo answer, built from your trades by fixed rules. No AI yet.</p>` : ""}
${m.calc ? `<button class="cogo2" data-co="calc" data-id="${m.calc}">Open in risk calculator →</button>` : ""}${m.pulse ? `<button class="cogo2" data-co="pulse">Open Daily pulse →</button>` : ""}</div>${m.local ? "" : `<p class="codis">${CO_DIS}</p>`}</div></div>`;
}
// "Coach sees" chips (what the coach is allowed to see).
function coChips() {
  const tt = coTid && S.trades.find(x => x.id === coTid),
    n = coTrades().length,
    opt = (v, l) => `<option value="${v}"${coScope === v ? " selected" : ""}>${l}</option>`,
    chip = (k, inner, lab) =>
      coOff[k]
        ? `<button class="cochip off" data-co="on" data-k="${k}" aria-label="${esc(tr("Add back: " + lab))}">+ ${lab}</button>`
        : `<span class="cochip">${inner}<button data-co="off" data-k="${k}" aria-label="${esc(tr("Remove: " + lab))}">${CO_SVG.x}</button></span>`;
  return `<div class="cosee"><span class="coseel">Coach sees:</span>${chip("tr", `<label class="covh" for="cosc">Trades</label><select id="cosc" data-co="sc">${tt ? opt("t", esc(tt.t) + " trade") : ""}${opt("n10", "Last 10 trades")}${opt("d30", "Last 30 days")}${opt("all", "All trades")}</select><b>${n}</b>`, "Trades")}${chip("st", "Strategy", "Strategy")}${chip("rk", "Risk settings", "Risk settings")}${chip("pl", "Daily pulse", "Daily pulse")}</div>`;
}
// Draw the coach window.
function coRender() {
  const w = $("cow");
  if (!w) return;
  w.hidden = !coOpen;
  document.documentElement.classList.toggle("coo", coOpen);
  const bt = $("cob");
  if (bt) {
    bt.setAttribute("aria-expanded", String(coOpen));
    bt.classList.toggle("dot", !coOpen && !coPulseDone() && !coSeen());
  }
  if (!coOpen) return;
  const d = $("cod"),
    ta = $("coq"),
    keep = ta ? ta.value : "",
    foc = ta && document.activeElement === ta,
    u = coUse();
  const head = `<div class="cohd"><span class="coav cohav">${coAv(coMkMood(), 34)}</span><div class="cohn"><b id="coh">Coach</b><small>Your trading coach</small></div>${coOk() && !(FB && !U) ? `<span class="cocnt">${u.m} / ${CO_MAX.m} today</span>` : ""}<button class="coib cox" data-co="x" aria-label="Close the coach">${CO_SVG.x}</button></div>`;
  if (FB && !U) {
    d.innerHTML = head + `<div class="cobody"><p class="mut">Log in to use the coach.</p></div>`;
    return;
  }
  if (!coOk()) {
    d.innerHTML =
      head +
      `<div class="cobody"><div class="coc"><span class="coav" style="margin-bottom:8px">${coAv("calm", 52)}</span><h3>Before you start with the coach</h3><ul>
<li>The coach reviews your process: stops, exits and sticking to your plan. It does not tell you what to buy or sell, and it never changes your trades.</li>
<li>It is a helper tool, not investment advice. It can be wrong, and the decisions are yours.</li>
<li>To answer, only your question, the data you choose under "Coach sees" and your chart are sent to the AI provider. Not your name or email.</li>
<li>While we test, the AI provider (Google Gemini, free tier) may use what is sent to improve its models, and people there may read it. Do not send anything sensitive.</li>
<li>Do not upload screenshots with account numbers or personal details.</li></ul>
<p><a href="privacy.html" target="_blank" rel="noopener">Read the privacy policy</a></p>
<div class="bk"><button data-co="ok">I understand and agree</button><button class="gh" data-co="x">Not now</button></div>
<p class="mut" style="font-size:12px;margin:10px 0 0">Draft text, to be finalized after a legal review.</p></div></div>`;
    const b = d.querySelector('[data-co="ok"]');
    if (b) b.focus();
    return;
  }
  const msgs = coMsgs.map(coBubble).join("");
  d.innerHTML =
    head +
    `<div class="cobody" id="colist" aria-live="polite">${msgs}${coMsgs.length < 2 ? `<div class="coqk"><button class="gh sm" data-co="qk" data-v="Where am I not following my plan?">Where am I not following my plan?</button><button class="gh sm" data-co="q10">Review my last 10 trades</button><button class="gh sm" data-co="at">Analyze a chart</button></div>` : ""}${coBusy ? `<div class="comsg coa cowb"><span class="coav">${coAv("calm", 30)}</span><p class="cowait" role="status">The coach is checking your trades…</p></div>` : ""}</div>
<div class="cofoot">${coErr ? `<p class="coerr" role="alert">${coErr}</p>` : ""}${coChips()}
${coImg ? `<div class="coim"><img src="${coImg.url}" alt=""><span data-nt>${esc(coImg.name)} · ${coImg.size < 1e6 ? Math.max(1, Math.round(coImg.size / 1e3)) + "KB" : (coImg.size / 1e6).toFixed(1) + "MB"}</span><button class="coib" data-co="rmi" aria-label="Remove image">${CO_SVG.x}</button></div>` : ""}
<div class="coin"><button class="coib coup" data-co="at" aria-label="Upload a chart">${CO_SVG.im}</button><label class="covh" for="coq">Question for the coach</label><input id="coq" type="text" maxlength="1000" autocomplete="off" placeholder="Ask your coach…"><button class="coib cosend" data-co="go" aria-label="Send"${coBusy ? " disabled" : ""}>${CO_SVG.go}</button></div>
<input type="file" id="cof" accept="image/png,image/jpeg,image/webp" hidden>
<p class="cohelp">${Math.max(0, CO_MAX.i - u.i)} of ${CO_MAX.i} chart images left today · Crop out account numbers first.</p></div>`;
  const t2 = $("coq");
  if (t2) {
    t2.value = keep;
    if (foc) t2.focus();
  }
  const l = $("colist");
  if (l) l.scrollTop = l.scrollHeight;
}
// First greeting of the day.
function coGreet() {
  if (coMsgs.length || !coOk()) return;
  const H = LANG === "he",
    hr = new Date().getHours(),
    hi =
      hr < 12
        ? H
          ? "בוקר טוב."
          : "Good morning."
        : hr < 18
          ? H
            ? "צהריים טובים."
            : "Good afternoon."
          : H
            ? "ערב טוב."
            : "Good evening.";
  if (coPulseDone())
    coMsgs.push({
      r: "a",
      local: true,
      mood: "pleased",
      a: esc(
        hi +
          " " +
          (H
            ? "מילאת את הדופק היומי היום. על מה תרצה שנסתכל?"
            : "You finished today's Daily pulse. What should we look at?")
      )
    });
  else
    coMsgs.push({
      r: "a",
      local: true,
      mood: "calm",
      pulse: true,
      a: esc(hi + " " + (H ? "מילאת כבר את הדופק היומי?" : "Did you finish today's Daily pulse?"))
    });
}
// Open or close the coach (optionally about one trade).
function coShow(v, tid) {
  if (v) {
    if (tid) {
      coTid = tid;
      coScope = "t";
      coOff.tr = false;
    }
    try {
      localStorage.setItem("tj_co_seen", coDay());
    } catch (e) {}
    coGreet();
  } else {
    coGen++;
    coMsgs = [];
    coImg = null;
    coErr = "";
    coBusy = false;
    coTid = null;
    coScope = "d30";
    coOff = {};
  }
  coOpen = v;
  coRender();
  if (v) {
    const e =
      $("coq") || $("cod").querySelector("[data-co=ok]") || $("cod").querySelector("button");
    if (e) e.focus();
  } else {
    const b = $("cob");
    if (b) b.focus();
  }
}
// Show the coach button only when logged in.
function coSync() {
  const b = $("cob");
  if (b) b.hidden = !!(FB && !U);
  if (FB && !U && coOpen) coShow(false);
  else coRender();
}
(function () {
  const st = document.createElement("style");
  st.textContent = `
.cobtn{position:fixed;bottom:calc(22px + env(safe-area-inset-bottom,0px));inset-inline-end:22px;z-index:800;width:64px;height:64px;padding:0;border-radius:50%;background:#1c1f26;color:#f4f1e9;border:0;box-shadow:0 8px 24px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}
.cobtn:hover{background:#2a2e38}.cobtn svg{width:38px;height:48px}
.cobtn.dot::after{content:"";position:absolute;top:3px;inset-inline-end:3px;width:13px;height:13px;border-radius:50%;background:#ff6b6b;border:2px solid #1c1f26}
.cow{position:fixed;bottom:calc(100px + env(safe-area-inset-bottom,0px));inset-inline-end:22px;z-index:850;width:380px;height:620px;max-height:calc(100vh - 124px);display:flex;flex-direction:column;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:22px;box-shadow:0 18px 50px rgba(0,0,0,.3);overflow:hidden}
.cow[hidden]{display:none}
@media(prefers-reduced-motion:no-preference){:root:not(.ay-m) .cow{animation:coIn .16s ease-out}}@keyframes coIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
#cod{display:flex;flex-direction:column;min-height:0;flex:1}
.cohd{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#1c1f26;color:#f4f1e9}
.cohn{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}.cohn b{font-size:16px}.cohn small{font-size:12.5px;color:rgba(244,241,233,.75)}
.cocnt{font-size:12px;font-weight:700;background:rgba(244,241,233,.12);border-radius:999px;padding:3px 9px;white-space:nowrap;unicode-bidi:plaintext}
.coav{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:#2d313b;color:#f4f1e9}
:root.th-l .coav{background:#ECE6FF;color:#1c1f26}
.cohav,:root.th-l .cohav{width:42px;height:42px;background:#2d313b;color:#f4f1e9}
.coa>.coav{width:34px;height:34px}
.coib{flex:0 0 42px;width:42px;height:42px;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:transparent;color:inherit;border:1px solid var(--line)}
.coib:hover{background:rgba(var(--rgb),.08)}.coib svg{width:20px;height:20px}
.cox{border-color:rgba(244,241,233,.3);color:#f4f1e9;flex-basis:40px;width:40px;height:40px}.cox:hover{background:rgba(244,241,233,.12)}
.cobody{flex:1;min-height:0;overflow:auto;padding:14px 12px;display:flex;flex-direction:column;gap:12px}
.comsg{display:flex;gap:8px;max-width:100%}
.coa{align-self:flex-start;align-items:flex-end;max-width:94%}
.coaw{min-width:0}
.cob2{background:var(--in);border:1px solid var(--line);border-radius:16px 16px 16px 5px;padding:10px 13px;font-size:14.5px;line-height:1.5}
[dir=rtl] .cob2{border-radius:16px 16px 5px 16px}
.cob2 p{margin:0 0 8px}.cob2 p:last-child{margin-bottom:0}.cob2 ul{margin:0 0 8px;padding-inline-start:18px}.cob2 li{margin-bottom:4px}
.codis{margin:4px 4px 0;font-size:11.5px;color:var(--mut)}
.codemo{font-size:12px;color:var(--mut);font-style:italic;margin:8px 0 0!important}
.cogo2{margin-top:10px;padding:8px 14px;font-size:13.5px}
.cou{align-self:flex-end;flex-direction:column;max-width:82%;background:var(--ink);color:var(--card);border-radius:16px 16px 5px 16px;padding:9px 13px;font-size:14.5px}
[dir=rtl] .cou{border-radius:16px 16px 16px 5px}
.cou p{margin:0;white-space:pre-wrap}.cou img{display:block;max-width:100%;max-height:170px;border-radius:10px;margin-bottom:6px}
.cowait{margin:0 0 6px;color:var(--mut);font-size:13.5px}
.coqk{display:flex;flex-wrap:wrap;gap:6px}.coqk button{font-size:12.5px}
.cofoot{border-top:1px solid var(--line);padding:8px 10px calc(10px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px;background:var(--card)}
.coerr{margin:0;color:var(--r);border:1px solid var(--r);border-radius:12px;padding:7px 11px;font-size:13px}
.cosee{display:flex;flex-wrap:wrap;align-items:center;gap:5px;font-size:12px}
.coseel{color:var(--mut);font-weight:600}
.cochip{display:inline-flex;align-items:center;gap:4px;background:var(--note);color:#2b2100;border-radius:999px;padding:2px 3px 2px 9px;font-weight:700;font-size:12px;line-height:1.2}
[dir=rtl] .cochip{padding:2px 9px 2px 3px}
.cochip select{width:auto;font:inherit;font-weight:700;color:inherit;background:transparent;border:0;padding:2px 0;border-radius:6px}
.cochip b{background:rgba(43,33,0,.12);border-radius:999px;padding:0 6px}
.cochip button{width:24px;height:24px;padding:0;border-radius:50%;background:transparent;color:inherit;display:inline-flex;align-items:center;justify-content:center}
.cochip button:hover{background:rgba(43,33,0,.12)}.cochip button svg{width:13px;height:13px}
button.cochip.off{background:transparent;color:var(--mut);border:1px dashed rgba(var(--rgb),.4);padding:3px 9px;min-height:26px}
button.cochip.off:hover{background:rgba(var(--rgb),.08)}
.coin{display:flex;align-items:center;gap:6px}
.coin input{flex:1;min-width:0;height:42px;border-radius:999px;padding:0 15px}
.cosend{background:var(--pen);color:#1c1f26;border:0}.cosend:hover{background:var(--ph)}.cosend:disabled{opacity:.45;cursor:default}
.coim{display:flex;align-items:center;gap:8px;background:var(--in);border:1px solid var(--line);border-radius:12px;padding:5px;font-size:12.5px}.coim img{width:52px;height:38px;object-fit:cover;border-radius:7px}.coim span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cohelp{margin:0;font-size:11.5px;color:var(--mut)}
.covh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cow.drag .cofoot{outline:2px dashed var(--hl);outline-offset:-4px}
.coc{background:var(--in);border:1px solid var(--line);border-radius:16px;padding:14px;font-size:14px}.coc h3{margin:0;font-family:"Young Serif","Frank Ruhl Libre",Georgia,serif;font-weight:400;font-size:19px}.coc ul{padding-inline-start:20px;margin:10px 0 12px}.coc li{margin-bottom:6px}.coc .coav{width:64px;height:64px}
.coask{display:inline-flex;align-items:center;gap:6px;padding:3px 12px 3px 3px!important}
[dir=rtl] .coask{padding:3px 3px 3px 12px!important}
.coask .coav{width:28px;height:28px}
body:not(.lo) main{padding-bottom:110px}
@media(max-width:640px){.cobtn{width:58px;height:58px;bottom:calc(18px + env(safe-area-inset-bottom,0px));inset-inline-end:16px}.cobtn svg{width:34px;height:43px}
 .cow{inset:0;width:auto;height:auto;max-height:none;border:0;border-radius:0;padding-top:env(safe-area-inset-top,0px);background:#1c1f26}
 #cod{background:var(--card)}
 html.coo{overflow:hidden}html.coo .cobtn{display:none}}`;
  document.head.appendChild(st);
  const b = document.createElement("button");
  b.id = "cob";
  b.className = "cobtn";
  b.type = "button";
  b.hidden = true;
  b.setAttribute("aria-haspopup", "dialog");
  b.setAttribute("aria-expanded", "false");
  b.setAttribute("aria-label", "Open coach chat");
  b.innerHTML = coAv("calm", 39);
  document.body.appendChild(b);
  const w = document.createElement("div");
  w.id = "cow";
  w.className = "cow";
  w.hidden = true;
  w.setAttribute("role", "dialog");
  w.setAttribute("aria-labelledby", "coh");
  w.innerHTML = `<div id="cod"></div>`;
  document.body.appendChild(w);
  b.onclick = () => coShow(!coOpen);
  coMkLoad();
  setInterval(coMkLoad, 6e5);
  w.addEventListener("dragover", e => {
    if (!coOk()) return;
    e.preventDefault();
    w.classList.add("drag");
  });
  w.addEventListener("dragleave", e => {
    if (!w.contains(e.relatedTarget)) w.classList.remove("drag");
  });
  w.addEventListener("drop", e => {
    w.classList.remove("drag");
    if (!coOk()) return;
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) coPick(f);
  });
})();
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-co]");
  if (!b || b.tagName !== "BUTTON") return;
  const a = b.dataset.co;
  if (a === "t") return coShow(true, b.dataset.id);
  if (a === "x") return coShow(false);
  if (a === "ok") {
    try {
      localStorage.setItem("tj_co_ok", "1");
    } catch (e) {}
    coGreet();
    coRender();
    const t = $("coq");
    if (t) t.focus();
    return;
  }
  if (a === "go") return coSend();
  if (a === "at") {
    const f = $("cof");
    if (f) f.click();
    return;
  }
  if (a === "rmi") {
    coImg = null;
    coRender();
    const t = $("coq");
    if (t) t.focus();
    return;
  }
  if (a === "off" || a === "on") {
    coOff[b.dataset.k] = a === "off";
    coRender();
    const n = $("cod").querySelector(`[data-k="${b.dataset.k}"]`);
    if (n) n.focus();
    return;
  }
  if (a === "qk") {
    const t = $("coq");
    if (t) {
      t.value = tr(b.dataset.v);
      coSend();
    }
    return;
  }
  if (a === "q10") {
    coScope = "n10";
    coOff.tr = false;
    const t = $("coq");
    if (t) {
      t.value = tr("Review my last 10 trades");
      coSend();
    }
    return;
  }
  if (a === "calc") {
    const t = S.trades.find(x => x.id === b.dataset.id);
    if (!t) return;
    S.calc = {
      t: t.t,
      dir: t.dir,
      e: String(t.e ?? ""),
      s: t.s == null ? "" : String(t.s),
      tg: t.tg == null ? "" : String(t.tg)
    };
    tab = "calc";
    coShow(false);
    view();
    scrollTo(0, 0);
    return;
  }
  if (a === "pulse") {
    tab = "pulse";
    coShow(false);
    view();
    scrollTo(0, 0);
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.id === "cosc") {
    coScope = el.value;
    coRender();
  } else if (el.id === "cof") {
    coPick(el.files && el.files[0]);
    el.value = "";
  }
});
document.addEventListener("keydown", e => {
  if (!coOpen) return;
  if (e.key === "Escape") {
    if (document.querySelector(".calw") || ltOpen) return;
    coShow(false);
    return;
  }
  if (e.key === "Enter" && !e.shiftKey && e.target && e.target.id === "coq" && !e.isComposing) {
    e.preventDefault();
    coSend();
    return;
  }
});
document.addEventListener("paste", e => {
  if (!coOpen || !coOk()) return;
  const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(
    i => i.kind === "file" && i.type.startsWith("image/")
  );
  if (!it) return;
  e.preventDefault();
  coPick(it.getAsFile());
});
// Make view() also refresh the coach button.
{
  const v0 = view;
  view = function () {
    v0();
    coSync();
  };
}
// "Ask coach" button for one trade.
function coAskBtn(t) {
  return `<button class="gh sm coask" data-co="t" data-id="${t.id}" aria-label="Ask coach about ${esc(t.t)}"><span class="coav">${coAv("calm", 26)}</span>Ask coach</button>`;
}
Object.assign(HE, {
  "Coach": "המאמן",
  "Your trading coach": "המאמן שלך למסחר",
  "Ask coach": "שאל את המאמן",
  "Open coach chat": "פתיחת הצ'אט עם המאמן",
  "Close the coach": "סגירת הצ'אט עם המאמן",
  "Log in to use the coach.": "התחבר כדי להשתמש במאמן.",
  "Before you start with the coach": "לפני שמתחילים עם המאמן",
  "The coach reviews your process: stops, exits and sticking to your plan. It does not tell you what to buy or sell, and it never changes your trades.":
    "המאמן מבקר את התהליך שלך: סטופים, יציאות והיצמדות לתוכנית. הוא לא אומר לך מה לקנות או למכור, והוא אף פעם לא משנה את העסקאות שלך.",
  "It is a helper tool, not investment advice. It can be wrong, and the decisions are yours.":
    "זה כלי עזר, לא ייעוץ השקעות. הוא יכול לטעות, וההחלטות שלך.",
  'To answer, only your question, the data you choose under "Coach sees" and your chart are sent to the AI provider. Not your name or email.':
    'כדי לענות, נשלחים לספק ה-AI רק השאלה, המידע שבחרת ב"המאמן רואה" והגרף. לא השם והמייל שלך.',
  "While we test, the AI provider (Google Gemini, free tier) may use what is sent to improve its models, and people there may read it. Do not send anything sensitive.":
    "בתקופת הניסוי, ספק ה-AI (Google Gemini, הגרסה החינמית) רשאי להשתמש במה שנשלח כדי לשפר את המודלים שלו, ואנשים שם עשויים לקרוא אותו. אל תשלח שום דבר רגיש.",
  "Do not upload screenshots with account numbers or personal details.":
    "אל תעלה צילומי מסך עם מספרי חשבון או פרטים אישיים.",
  "Read the privacy policy": "קרא את מדיניות הפרטיות",
  "I understand and agree": "הבנתי ומסכים",
  "Not now": "לא עכשיו",
  "Draft text, to be finalized after a legal review.": "טקסט טיוטה, ייקבע סופית אחרי בדיקה משפטית.",
  "Coach sees:": "המאמן רואה:",
  "Trades": "עסקאות",
  "Strategy": "אסטרטגיה",
  "Risk settings": "הגדרות סיכון",
  "Daily pulse": "דופק יומי",
  "Last 10 trades": "10 אחרונות",
  "Last 30 days": "30 יום",
  "All trades": "כל העסקאות",
  "The coach is checking your trades…": "המאמן בודק את העסקאות…",
  "Chart you uploaded": "הגרף שהעלית",
  "Demo answer, built from your trades by fixed rules. No AI yet.":
    "תשובת הדגמה, מחושבת מהעסקאות שלך לפי כללים קבועים. עדיין בלי AI.",
  "A helper tool only, not investment advice.": "כלי עזר בלבד, לא ייעוץ השקעות.",
  "Open in risk calculator →": "פתח במחשבון הסיכונים ←",
  "Open Daily pulse →": "פתח את הדופק היומי ←",
  "Where am I not following my plan?": "איפה אני לא עומד בתוכנית?",
  "Review my last 10 trades": "בדוק את 10 העסקאות האחרונות",
  "Analyze a chart": "נתח גרף",
  "Remove image": "הסר תמונה",
  "Upload a chart": "העלאת גרף",
  "Question for the coach": "שאלה למאמן",
  "Send": "שלח",
  "Ask your coach…": "שאל את המאמן…",
  "You reached today's message limit. Try again tomorrow.":
    "הגעת למגבלת ההודעות להיום. נסה שוב מחר.",
  "You reached today's image limit. Try again tomorrow.": "הגעת למגבלת התמונות להיום. נסה שוב מחר.",
  "Use a PNG, JPEG or WebP image.": "השתמש בתמונה מסוג PNG, JPEG או WebP.",
  "That image is too large. Use a smaller screenshot.": "התמונה גדולה מדי. נסה צילום מסך קטן יותר.",
  "Could not read that image. Try another file.": "לא הצלחתי לקרוא את התמונה. נסה קובץ אחר.",
  "The coach took too long. Try again.": "המאמן לקח יותר מדי זמן. נסה שוב.",
  "Could not reach the coach. Check your connection and try again.":
    "אין חיבור למאמן. בדוק את החיבור ונסה שוב.",
  "The coach is not available for this account.": "המאמן לא זמין לחשבון הזה.",
  "You reached today's limit. Try again tomorrow.": "הגעת למגבלה של היום. נסה שוב מחר.",
  "The coach could not answer right now. Try again later.":
    "המאמן לא הצליח לענות כרגע. נסה שוב מאוחר יותר."
});
