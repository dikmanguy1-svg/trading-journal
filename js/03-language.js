/*
 * 03-language.js — part of the TradeInk app script.
 *
 * Hebrew / English translation.
 * - LANG: current language (from ?lang= or saved choice).
 * - HE: exact-text dictionary (comes from he.js, more entries are added by later files).
 * - HR: pattern rules for text with numbers ("Answer all 5 questions" ...).
 * - tr() translates one string; trDom() translates a rendered piece of the page.
 * - cf / pr / al: translated confirm / prompt / alert.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Current language: "he" or "en".
const LANG = (() => {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "he" || q === "en") {
      localStorage.setItem("tj_lang", q);
      return q;
    }
    const v = localStorage.getItem("tj_lang");
    if (v === "he" || v === "en") return v;
  } catch (e) {}
  return "en";
})();
// Hebrew dictionary for exact texts (filled by he.js and later files).
const HE = window.HE_EXT || {};
// The About page opens on its Hebrew part for Hebrew users.
if (LANG === "he")
  document
    .querySelectorAll('a[href="about.html"]')
    .forEach(a => a.setAttribute("href", "about.html#he"));
// Hebrew rules for texts that contain numbers.
const HR = [
  [
    /^Answer all (\d+) questions \((\d+) answered\)$/,
    x => "ענה על כל " + x[1] + " השאלות (" + x[2] + " נענו)"
  ],
  [/^([\s\S]+) \((\d+) “No”\)$/, x => trc(x[1]) + " (" + x[2] + " “לא”)"],
  [/^Loading prices (\d+)\/(\d+)\.\.\.$/, x => "טוען מחירים " + x[1] + "/" + x[2] + "..."],
  [
    /^Prices updated (\S+) · US market (open|closed)(?: \((\d+) not found\))?(.*)$/,
    x =>
      "המחירים עודכנו " +
      x[1] +
      ' · שוק ארה"ב ' +
      (x[2] === "open" ? "פתוח" : "סגור") +
      (x[3] ? " (" + x[3] + " לא נמצאו)" : "") +
      (x[4] ? " · " + trc(x[4].replace(/^ · /, "")) : "")
  ],
  [/^Level (\d+) · (.+)$/, x => "רמה " + x[1] + " · " + trc(x[2])],
  [/^Level (\d+): (.+?)!$/, x => "רמה " + x[1] + ": " + trc(x[2]) + "!"],
  [/^Lv (\d+) · (\d+) XP$/, x => "רמה " + x[1] + " · " + x[2] + " XP"],
  [/^Badge: (.+)$/, x => "תג: " + trc(x[1])],
  [/^([★☆]) (.+)$/, x => x[1] + " " + trc(x[2])],
  [
    /^(\d+) XP to level (\d+)\. XP are experience points.*$/,
    x =>
      x[1] +
      " נקודות XP לרמה " +
      x[2] +
      ". XP הן נקודות ניסיון: מקבלים אותן על הרגלים טובים, והן מעלות את הרמה שלך. אפשר לצבור אותן ברישום עסקאות, כתיבת סיבות, הגדרת סטופ ומילוי הבדיקה היומית."
  ],
  [
    /^(Exit type|Exit date|Entry date|Side|Entry|Stop|Target|Current price) ([A-Z.]{1,6})$/,
    x => trc(x[1]) + " " + x[2]
  ],
  [
    /^Only (\d+) screening questions fit, so (\d+) of your choices were left out$/,
    x => "רק " + x[1] + " שאלות סינון נכנסות, ולכן " + x[2] + " מהבחירות שלך נשארו בחוץ"
  ],
  [/^Remove (.+)$/, x => "הסר " + x[1]],
  [/^Answer (\d+)$/, x => "תשובה " + x[1]],
  [/^Question (\d+)$/, x => "שאלה " + x[1]],
  [/^Rule (\d+)$/, x => "חוק " + x[1]],
  [/^Delete rule (\d+)$/, x => "מחיקת חוק " + x[1]],
  [/^Followed my rules\? (.+)$/, x => "עמדתי בחוקים? " + x[1]],
  [/^auto: (.*)$/, x => "אוטומטי: " + x[1]],
  [/^now (.+)$/, x => "עכשיו " + x[1]],
  [/^Shares \((.+)\)$/, x => "מניות (" + trc(x[1]) + ")"]
];
// Translate one exact text (dictionary first, then rules).
function trc(c) {
  if (HE[c] !== undefined) return HE[c];
  for (const r of HR) {
    const x = c.match(r[0]);
    if (x) return r[1](x);
  }
  if (c.includes(" · ")) {
    const p = c.split(" · "),
      q = p.map(trc);
    if (q.some((v, i) => v !== p[i])) return q.join(" · ");
  }
  return c;
}
// Translate a string to Hebrew when the site is in Hebrew (keeps spaces around it).
function tr(s) {
  if (LANG !== "he" || typeof s !== "string") return s;
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m[2]) return s;
  const r = trc(m[2]);
  return r === m[2] ? s : m[1] + r + m[3];
}
// Translated confirm / prompt / alert.
const cf = m => confirm(tr(m)),
  pr = m => prompt(tr(m)),
  al = m => alert(tr(m));
// Translate one text node.
function trText(n) {
  const p = n.parentElement;
  if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName) || (p.closest && p.closest("[data-nt]")))
    return;
  const v = tr(n.nodeValue);
  if (v !== n.nodeValue) n.nodeValue = v;
}
// Translate a rendered part of the page (texts and labels).
function trDom(r) {
  if (LANG !== "he") return;
  if (r.nodeType === 3) return trText(r);
  if (r.nodeType !== 1) return;
  r.querySelectorAll("option:not([value])").forEach(o => o.setAttribute("value", o.textContent));
  const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT),
    L = [];
  let n;
  while ((n = w.nextNode())) L.push(n);
  L.forEach(trText);
  [r, ...r.querySelectorAll("[placeholder],[aria-label],[title]")].forEach(e =>
    ["placeholder", "aria-label", "title"].forEach(a => {
      const v = e.getAttribute && e.getAttribute(a);
      if (v) {
        const t = tr(v);
        if (t !== v) e.setAttribute(a, t);
      }
    })
  );
  r.querySelectorAll("input[data-k=qe]").forEach(e => {
    const t = tr(e.value);
    if (t !== e.value) e.value = t;
  });
}
