/*
 * 18e-scanner.js — part of the TradeInk app script.
 *
 * Weekly scanner tab ("scan").
 * - The data is built once a week by scanner/build.py (GitHub Actions) and served by our
 *   server at CO_URL + "/scan" to signed-in users only. It is kept in memory, never saved.
 * - Each user writes their own conditions (S.scan.c). The tab only filters by them.
 * - Legal rules (agent 4): empty fields with no examples, no ready-made scans, sort by name
 *   by default, no ranking or highlights, value + source + date next to each stock, fixed
 *   legal line above the results, no index names, no ads, no pushy alerts.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// The scanner is shown as "Coming soon" while this is false (turned on by Guy, 12.11).
const SCAN_ON = true;
// Texts in the current language.
const scL = (en, he) => (LANG === "he" ? he : en);

// The measures a user can filter by: key, English name, Hebrew name, source (M = Massive,
// F = Finnhub), type (n = number, b = yes/no, c = choice), unit, and a general explanation.
const SCF = [
  [
    "price",
    "Price",
    "מחיר",
    "M",
    "n",
    "$",
    "The last daily closing price.",
    "מחיר הסגירה היומי האחרון."
  ],
  [
    "chg1w",
    "1-week change",
    "שינוי בשבוע",
    "M",
    "n",
    "%",
    "Price change over the last 5 trading days.",
    "שינוי המחיר ב-5 ימי המסחר האחרונים."
  ],
  [
    "chg1m",
    "1-month change",
    "שינוי בחודש",
    "M",
    "n",
    "%",
    "Price change over the last 21 trading days.",
    "שינוי המחיר ב-21 ימי המסחר האחרונים."
  ],
  [
    "fromHigh52",
    "Distance from 52-week high",
    "מרחק משיא 52 שבועות",
    "M",
    "n",
    "%",
    "How far the price is from its highest point of the last year. 0 means at the high; the number is negative below it.",
    "כמה המחיר רחוק מהנקודה הגבוהה ביותר בשנה האחרונה. 0 זה בשיא, ומתחתיו המספר שלילי."
  ],
  [
    "fromLow52",
    "Distance from 52-week low",
    "מרחק משפל 52 שבועות",
    "M",
    "n",
    "%",
    "How far the price is above its lowest point of the last year.",
    "כמה המחיר גבוה מהנקודה הנמוכה ביותר בשנה האחרונה."
  ],
  [
    "newHigh52w",
    "New 52-week high this week",
    "שיא 52 שבועות חדש השבוע",
    "M",
    "b",
    "",
    "Yes if the price went above its previous 52-week high during the last 5 trading days.",
    "כן, אם המחיר עבר את שיא 52 השבועות הקודם שלו ב-5 ימי המסחר האחרונים."
  ],
  [
    "vsMa20",
    "Price vs 20-day average",
    "מחיר מול ממוצע 20 יום",
    "M",
    "n",
    "%",
    "How far the price is above (positive) or below (negative) the average closing price of the last 20 days.",
    "כמה המחיר מעל (חיובי) או מתחת (שלילי) לממוצע מחירי הסגירה ב-20 הימים האחרונים."
  ],
  [
    "vsMa50",
    "Price vs 50-day average",
    "מחיר מול ממוצע 50 יום",
    "M",
    "n",
    "%",
    "The same, for the average of the last 50 days.",
    "אותו דבר, לממוצע של 50 הימים האחרונים."
  ],
  [
    "vsMa150",
    "Price vs 150-day average",
    "מחיר מול ממוצע 150 יום",
    "M",
    "n",
    "%",
    "The same, for the average of the last 150 days.",
    "אותו דבר, לממוצע של 150 הימים האחרונים."
  ],
  [
    "vsMa200",
    "Price vs 200-day average",
    "מחיר מול ממוצע 200 יום",
    "M",
    "n",
    "%",
    "The same, for the average of the last 200 days.",
    "אותו דבר, לממוצע של 200 הימים האחרונים."
  ],
  [
    "rsi14",
    "RSI (14 days)",
    "RSI (14 יום)",
    "M",
    "n",
    "",
    "A 0 to 100 measure of how strong recent up days were compared with down days.",
    "מדד בין 0 ל-100 שמשווה את עוצמת ימי העלייה האחרונים לעוצמת ימי הירידה."
  ],
  [
    "atrPct",
    "ATR (14 days), % of price",
    "ATR (14 יום), באחוזים מהמחיר",
    "M",
    "n",
    "%",
    "The average daily price range, as a percent of the price. It measures how much the stock usually moves in a day.",
    "טווח התנודה היומי הממוצע, באחוזים מהמחיר. מודד כמה המניה זזה בדרך כלל ביום."
  ],
  [
    "atr14",
    "ATR (14 days), in $",
    "ATR (14 יום), בדולרים",
    "M",
    "n",
    "$",
    "The average daily price range, in dollars.",
    "טווח התנודה היומי הממוצע, בדולרים."
  ],
  [
    "avgVol50",
    "Average volume, 50 days",
    "נפח ממוצע, 50 יום",
    "M",
    "n",
    "sh",
    "The average number of shares traded per day over the last 50 days.",
    "מספר המניות הממוצע שנסחר ביום ב-50 הימים האחרונים."
  ],
  [
    "volVsAvg50",
    "Last day volume vs 50-day average",
    "נפח היום האחרון מול ממוצע 50 יום",
    "M",
    "n",
    "x",
    "The last day's volume divided by the 50-day average. 1 means a usual day.",
    "הנפח של היום האחרון חלקי הממוצע של 50 יום. 1 זה יום רגיל."
  ],
  [
    "rs3m",
    "Relative strength vs SPY, 3 months",
    "חוזק יחסי מול SPY, 3 חודשים",
    "M",
    "n",
    "pt",
    "The stock's 3-month return minus the return of the SPY fund over the same time, in percentage points.",
    "התשואה של המניה ב-3 חודשים פחות התשואה של קרן SPY באותו זמן, בנקודות אחוז."
  ],
  [
    "rs6m",
    "Relative strength vs SPY, 6 months",
    "חוזק יחסי מול SPY, 6 חודשים",
    "M",
    "n",
    "pt",
    "The same, over 6 months.",
    "אותו דבר, ב-6 חודשים."
  ],
  [
    "rs12m",
    "Relative strength vs SPY, 12 months",
    "חוזק יחסי מול SPY, 12 חודשים",
    "M",
    "n",
    "pt",
    "The same, over 12 months.",
    "אותו דבר, ב-12 חודשים."
  ],
  [
    "size",
    "Company size (market cap)",
    "גודל חברה (שווי שוק)",
    "F",
    "c",
    "",
    "Market cap is the share price times the number of shares. Sizes: mega over $200B, large $10B to $200B, mid $2B to $10B, small under $2B. This is the usual market split; the exact limits vary a little between sources. Only sizes that have stocks in our list this week are shown.",
    "שווי שוק הוא מחיר המניה כפול מספר המניות. הגדלים: ענקית מעל 200 מיליארד $, גדולה 10 עד 200 מיליארד $, בינונית 2 עד 10 מיליארד $, קטנה מתחת ל-2 מיליארד $. זו חלוקה מקובלת בשוק, והגבולות משתנים מעט בין מקורות. מוצגים רק גדלים שיש בהם מניות ברשימה שלנו השבוע."
  ],
  [
    "pe",
    "P/E",
    "מכפיל רווח (P/E)",
    "F",
    "n",
    "",
    "Price divided by earnings per share of the last 12 months.",
    "המחיר חלקי הרווח למניה ב-12 החודשים האחרונים."
  ],
  [
    "epsGrowth",
    "Earnings per share growth",
    "צמיחה ברווח למניה",
    "F",
    "n",
    "%",
    "Change in earnings per share over the last 12 months compared with the year before.",
    "השינוי ברווח למניה ב-12 החודשים האחרונים לעומת השנה שלפני."
  ],
  [
    "revGrowth",
    "Revenue growth",
    "צמיחה בהכנסות",
    "F",
    "n",
    "%",
    "Change in revenue over the last 12 months compared with the year before.",
    "השינוי בהכנסות ב-12 החודשים האחרונים לעומת השנה שלפני."
  ],
  [
    "debtToEquity",
    "Debt to equity",
    "חוב להון",
    "F",
    "n",
    "",
    "Total debt divided by shareholders' equity, from the last quarterly report.",
    "סך החוב חלקי ההון העצמי, מהדוח הרבעוני האחרון."
  ],
  [
    "earnDays",
    "Days to next earnings report",
    "ימים עד דוח הרווחים הבא",
    "F",
    "n",
    "d",
    "Days from today to the next scheduled earnings report. Report dates can move.",
    "ימים מהיום ועד דוח הרווחים הבא שנקבע. תאריכי דוחות יכולים לזוז."
  ],
  [
    "industry",
    "Industry",
    "ענף",
    "F",
    "c",
    "",
    "The company's industry group, as the data provider lists it.",
    "קבוצת הענף של החברה, כפי שספק הנתונים מסווג אותה."
  ]
];
const SCFK = Object.fromEntries(SCF.map(f => [f[0], f]));
const SCSRC = { M: "Massive", F: "Finnhub" };

// Company size groups (the usual market split) and their names.
const SCSIZE = ["mega", "large", "mid", "small"];
function scSizeL(v) {
  const m = {
    mega: ["Mega (over $200B)", "ענקית (מעל 200 מיליארד $)"],
    large: ["Large ($10B to $200B)", "גדולה (10 עד 200 מיליארד $)"],
    mid: ["Mid ($2B to $10B)", "בינונית (2 עד 10 מיליארד $)"],
    small: ["Small (under $2B)", "קטנה (מתחת ל-2 מיליארד $)"]
  }[v];
  return m ? scL(m[0], m[1]) : esc(v);
}

// The loaded weekly data: st = idle / load / ok / none (not built yet) / err.
const SCD = { st: "idle", d: null };

// The user's scanner settings (conditions and sort), created on first use.
function scS() {
  if (!S.scan || typeof S.scan !== "object") S.scan = { c: [], sk: "", sd: 1 };
  if (!Array.isArray(S.scan.c)) S.scan.c = [];
  return S.scan;
}

// The value of one measure for one stock (null when there is no data).
function scVal(r, k) {
  if (k === "size") return r.capM == null ? null : r.capM >= 200000 ? "mega" : r.capM >= 10000 ? "large" : r.capM >= 2000 ? "mid" : "small";
  if (k === "earnDays") {
    if (!r.nextEarnings) return null;
    const d = Math.round(
      (new Date(r.nextEarnings + "T00:00:00Z") -
        new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) /
        864e5
    );
    return isFinite(d) ? d : null;
  }
  return r[k] == null ? null : r[k];
}

// Show a value with its unit.
function scFmt(v, f) {
  if (v == null) return "—";
  if (f[4] === "b") return v ? scL("Yes", "כן") : scL("No", "לא");
  if (f[0] === "size") return scSizeL(v);
  if (f[4] === "c") return esc(v);
  const u = f[5],
    n =
      Math.abs(v) >= 1000
        ? Math.round(v).toLocaleString("en-US")
        : u === "d" || u === "sh"
          ? String(Math.round(v))
          : v.toFixed(2);
  if (u === "$") return "$" + n;
  if (u === "%") return n + "%";
  if (u === "B") return "$" + n + "B";
  if (u === "x") return n + "×";
  if (u === "pt") return n + " " + scL("pt", "נק'");
  if (u === "d") return n + " " + scL("days", "ימים");
  return n;
}

// The conditions that are complete (measure, comparison and value all chosen).
function scActive() {
  return scS().c.filter(c => {
    const f = SCFK[c.f];
    if (!f || String(c.v ?? "").trim() === "") return false;
    if (f[4] === "n") return (c.op === ">=" || c.op === "<=") && isFinite(parseFloat(c.v));
    return true;
  });
}

// Does a stock meet one condition? Missing data never meets it.
function scMeets(r, c) {
  const f = SCFK[c.f],
    v = scVal(r, c.f);
  if (v == null) return false;
  if (f[4] === "b") return v === (c.v === "yes");
  if (f[4] === "c") return v === c.v;
  const x = parseFloat(c.v);
  return c.op === ">=" ? v >= x : v <= x;
}

// Calculation date as dd.mm.yyyy.
function scDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : esc(s || "");
}

// The scanner page (the frame; the results are filled by scRes()).
function scanPage() {
  if (!SCAN_ON)
    return `<div class="card scn"><h2>${scL("Weekly scanner", "סורק שבועי")} <span class="soon">${scL("Coming soon", "בקרוב")}</span></h2><p class="mut">${scL("Coming soon: a weekly stock scanner where you write your own criteria.", "בקרוב: סורק מניות שבועי לפי הקריטריונים שתגדיר בעצמך.")}</p></div>`;
  return `<div class="card scn" id="scn">${scInner()}</div>`;
}

// Conditions editor + results.
function scInner() {
  const s = scS(),
    // Choices for choice fields: only values that exist in this week's data.
    opts = k => {
      if (!SCD.d) return [];
      const have = new Set(SCD.d.rows.map(r => scVal(r, k)).filter(Boolean));
      if (k === "size") return SCSIZE.filter(x => have.has(x)).map(x => [x, scSizeL(x)]);
      return [...have].sort().map(x => [x, x]);
    },
    row = (c, i) => {
      const f = SCFK[c.f];
      let h = `<div class="scc"><label class="scl"><span class="vh">${scL("Measure", "מדד")}</span><select data-sc="f" data-i="${i}" aria-label="${scL("Measure", "מדד")}"><option value="">${scL("Choose a measure", "בחר מדד")}</option>${SCF.map(x => `<option value="${x[0]}"${x[0] === c.f ? " selected" : ""}>${scL(x[1], x[2])}</option>`).join("")}</select></label>`;
      if (f && f[4] === "n")
        h += `<label class="scl"><span class="vh">${scL("Comparison", "השוואה")}</span><select data-sc="op" data-i="${i}" aria-label="${scL("Comparison", "השוואה")}"><option value="">${scL("Choose", "בחר")}</option><option value=">="${c.op === ">=" ? " selected" : ""}>${scL("At least (≥)", "לפחות (≥)")}</option><option value="<="${c.op === "<=" ? " selected" : ""}>${scL("At most (≤)", "לכל היותר (≤)")}</option></select></label><label class="scl"><span class="vh">${scL("Value", "ערך")}</span><input type="number" step="any" inputmode="decimal" data-sc="v" data-i="${i}" value="${esc(c.v ?? "")}" placeholder="${scL("Value", "ערך")}" aria-label="${scL("Value", "ערך")}"></label>`;
      if (f && f[4] === "b")
        h += `<label class="scl"><span class="vh">${scL("Value", "ערך")}</span><select data-sc="v" data-i="${i}" aria-label="${scL("Value", "ערך")}"><option value="">${scL("Choose", "בחר")}</option><option value="yes"${c.v === "yes" ? " selected" : ""}>${scL("Yes", "כן")}</option><option value="no"${c.v === "no" ? " selected" : ""}>${scL("No", "לא")}</option></select></label>`;
      if (f && f[4] === "c")
        h += `<label class="scl"><span class="vh">${scL("Value", "ערך")}</span><select data-sc="v" data-i="${i}" aria-label="${scL("Value", "ערך")}"><option value="">${scL("Choose", "בחר")}</option>${opts(c.f).map(([x, lab]) => `<option value="${esc(x)}"${x === c.v ? " selected" : ""}>${esc(lab)}</option>`).join("")}</select></label>`;
      h += `<button type="button" class="gh sm" data-sca="del" data-i="${i}" aria-label="${scL("Remove this condition", "הסר את התנאי")}">✕</button></div>`;
      if (f) h += `<p class="mut sm scd">${scL(f[6], f[7])}</p>`;
      return h;
    };
  return `<h2>${scL("Weekly scanner", "סורק שבועי")}</h2>
<p class="mut">${scL("Write your own conditions. The list shows only the stocks that meet all of them. Stocks: about 500 of the largest US companies by market cap (our own list). The data is calculated once a week.", 'כתוב את התנאים שלך. הרשימה תציג רק את המניות שעומדות בכולם. המניות: כ-500 החברות הגדולות בארה"ב לפי שווי שוק (רשימה שלנו). הנתונים מחושבים פעם בשבוע.')}</p>
<h3 class="sch">${scL("Your conditions", "התנאים שלך")}</h3>
<div class="sccs">${s.c.map(row).join("") || `<p class="mut sm">${scL("No conditions yet.", "עוד אין תנאים.")}</p>`}</div>
${s.c.length < 20 ? `<button type="button" class="gh" data-sca="add">${scL("+ Add a condition", "+ הוסף תנאי")}</button>` : ""}
<details class="scg"><summary>${scL("What each measure means", "מה כל מדד מודד")}</summary><dl>${SCF.map(f => `<dt>${scL(f[1], f[2])} <span class="mut sm">(${SCSRC[f[3]]})</span></dt><dd>${scL(f[6], f[7])}</dd>`).join("")}</dl></details>
<div id="scnres" aria-live="polite">${scResHTML()}</div>`;
}

// Results part.
function scResHTML() {
  if (SCD.st === "idle" || SCD.st === "load")
    return `<p class="mut">${scL("Loading the weekly data…", "טוען את הנתונים השבועיים…")}</p>`;
  if (SCD.st === "none")
    return `<p class="mut">${scL("The first weekly calculation is not ready yet. It runs every Saturday morning.", "החישוב השבועי הראשון עוד לא מוכן. הוא רץ כל שבת בבוקר.")}</p>`;
  if (SCD.st === "err")
    return `<p class="mut">${scL("Could not load the weekly data right now. Try again later.", "לא הצלחנו לטעון את הנתונים השבועיים כרגע. נסה שוב מאוחר יותר.")} <button type="button" class="gh sm" data-sca="retry">${scL("Try again", "נסה שוב")}</button></p>`;
  const d = SCD.d,
    s = scS(),
    act = scActive(),
    date = scDate(d.asOf);
  let h = `<p class="scleg">${scL("The list shows stocks that meet criteria you defined yourself. It is not a recommendation to buy, sell or hold any stock, and it is not investment advice.", "הרשימה מציגה מניות שעומדות בקריטריונים שהגדרת בעצמך. זו לא המלצה לקנות, למכור או להחזיק אף מניה, ואינה ייעוץ השקעות.")}</p>
<p class="mut sm">${scL(`Calculated on ${date}. The data may be out of date or wrong.`, `חושב ב-${date}. הנתונים עשויים להיות לא מעודכנים או שגויים.`)}</p>`;
  if (!act.length)
    return (
      h +
      `<p class="mut">${scL("Add a condition and fill in its value to see the stocks that meet it.", "הוסף תנאי ומלא את הערך שלו כדי לראות את המניות שעומדות בו.")}</p>`
    );
  const keys = [...new Set(act.map(c => c.f))],
    sk = s.sk && (s.sk === "name" || keys.includes(s.sk)) ? s.sk : "name",
    sd = s.sd === -1 ? -1 : 1,
    rows = d.rows.filter(r => act.every(c => scMeets(r, c)));
  rows.sort((a, b) => {
    if (sk === "name") return sd * String(a.name || a.s).localeCompare(String(b.name || b.s), "en");
    const x = scVal(a, sk),
      y = scVal(b, sk);
    if (x == null || y == null) return x == null ? 1 : -1;
    return sd * (typeof x === "string" ? x.localeCompare(y, "en") : x - y);
  });
  const src = [...new Set(["F", ...keys.map(k => SCFK[k][3])])].map(x => SCSRC[x]).join(", "),
    th = (k, lab) => {
      const on = sk === k,
        ar = on ? (sd === 1 ? "ascending" : "descending") : "none";
      return `<th aria-sort="${ar}"><button type="button" class="scs" data-sca="sort" data-sk="${k}">${lab}${on ? (sd === 1 ? " ▲" : " ▼") : ""}</button></th>`;
    };
  h += `<p>${scL(`${rows.length} stocks meet all of your conditions.`, `${rows.length} מניות עומדות בכל התנאים שלך.`)} <span class="mut sm">${scL("Stocks with no data for one of your measures are not shown.", "מניות בלי נתון לאחד המדדים שבחרת לא מוצגות.")}</span></p>`;
  if (!rows.length) return h;
  h += `<div class="wrap"><table class="sct"><thead><tr>${th("name", scL("Company", "חברה"))}${keys.map(k => th(k, scL(SCFK[k][1], SCFK[k][2]))).join("")}<th class="scsrc">${scL("Source and date", "מקור ותאריך")}</th></tr></thead><tbody>${rows
    .map(
      r =>
        `<tr><td class="scn1"><b>${esc(r.s)}</b> <span class="mut sm">${esc(r.name || "")}</span></td>${keys.map(k => `<td data-l="${esc(scL(SCFK[k][1], SCFK[k][2]))}">${scFmt(scVal(r, k), SCFK[k])}</td>`).join("")}<td class="mut sm scsrc" data-l="${scL("Source and date", "מקור ותאריך")}">${src} · ${date}</td></tr>`
    )
    .join("")}</tbody></table></div>`;
  return h;
}

// Re-draw only the results (keeps the cursor in the value field).
function scRes() {
  const el = $("scnres");
  if (el) el.innerHTML = scResHTML();
}

// Re-draw the whole scanner card.
function scRedraw(focus) {
  const el = $("scn");
  if (!el) return;
  el.innerHTML = scInner();
  if (focus) {
    const f = el.querySelector(focus);
    if (f) f.focus();
  }
}

// Load the weekly data from our server (once per visit).
async function scLoad() {
  if (SCD.st === "load" || SCD.st === "ok") return;
  if (!U) return;
  SCD.st = "load";
  try {
    const tok = await U.getIdToken(),
      r = await fetch(CO_URL.replace(/\/+$/, "") + "/scan", {
        headers: { Authorization: "Bearer " + tok }
      });
    if (r.status === 404) SCD.st = "none";
    else if (!r.ok) SCD.st = "err";
    else {
      const d = await r.json();
      if (!d || !Array.isArray(d.rows)) throw 0;
      SCD.d = d;
      SCD.st = "ok";
    }
  } catch (e) {
    SCD.st = "err";
  }
  scRedraw();
}

// Called after the tab is drawn.
function scanAfter() {
  if (SCAN_ON) scLoad();
}

// Clicks: add / remove a condition, sort, retry.
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-sca]");
  if (!b || !b.closest("#scn")) return;
  const s = scS(),
    a = b.dataset.sca,
    i = +b.dataset.i;
  if (a === "add" && s.c.length < 20) {
    s.c.push({ f: "", op: "", v: "" });
    save();
    scRedraw(`select[data-sc="f"][data-i="${s.c.length - 1}"]`);
  } else if (a === "del") {
    s.c.splice(i, 1);
    save();
    scRedraw();
  } else if (a === "sort") {
    const k = b.dataset.sk;
    if (s.sk === k || (!s.sk && k === "name")) s.sd = s.sd === -1 ? 1 : -1;
    else {
      s.sk = k;
      s.sd = 1;
    }
    save();
    scRes();
  } else if (a === "retry") {
    SCD.st = "idle";
    scRedraw();
    scLoad();
  }
});

// Typing a value or choosing a measure / comparison.
function scEdit(e) {
  const el = e.target;
  if (!el.dataset || !el.dataset.sc || !el.closest("#scn")) return;
  const s = scS(),
    c = s.c[+el.dataset.i];
  if (!c) return;
  const k = el.dataset.sc;
  if (k === "f") {
    if (c.f === el.value) return;
    c.f = SCFK[el.value] ? el.value : "";
    c.op = "";
    c.v = "";
    save();
    scRedraw(
      `[data-sc="${SCFK[c.f] && SCFK[c.f][4] === "n" ? "op" : "v"}"][data-i="${el.dataset.i}"]`
    );
    return;
  }
  if (k === "op") c.op = el.value === ">=" || el.value === "<=" ? el.value : "";
  if (k === "v") c.v = String(el.value).slice(0, 40);
  save();
  scRes();
}
document.addEventListener("input", scEdit);
document.addEventListener("change", e => {
  if (e.target.tagName === "SELECT") scEdit(e);
});

// The tab in the navigation (no number: it is not one of the trade steps).
T.push(["scan", "Weekly scanner"]);
HE["Weekly scanner"] = "סורק שבועי";
