/*
 * 18c-xp-perks.js — part of the TradeInk app script.
 *
 * XP perks: every 5 levels unlock something.
 * - Level 5: more Wick messages and chart images a day.
 * - Level 10: the Forest color theme and a cap for Wick.
 * - Level 15: a gold star next to your level (later also a plan discount).
 * - Level 20: a free month of a paid plan, when paid plans launch.
 * Tapping the level pill at the top opens a window that explains XP, levels and perks.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Perks: [level, name, what you get, "now" = works today, "later" = needs paid plans].
const XPK = [
  [
    5,
    "More from Wick",
    "30 messages and 8 chart images a day with Wick, instead of 20 and 5.",
    "now"
  ],
  [10, "Forest theme and Wick's cap", "Unlock the Forest color theme and a cap for Wick.", "now"],
  [15, "Gold star", "A gold star next to your level. Later also a discount on paid plans.", "now"],
  [20, "Free month", "A free month of a paid plan, when paid plans launch.", "later"]
];
// Current level (0 before the journal is loaded).
const xpL = () => {
  try {
    return gx().L;
  } catch (e) {
    return 0;
  }
};
// The Forest theme is unlocked.
const inkOk = () => xpL() >= 10;
// Wick wears his cap (unlocked at level 10, can be turned off).
function capOn() {
  if (xpL() < 10) return false;
  try {
    return localStorage.getItem("tj_cap") !== "0";
  } catch (e) {
    return true;
  }
}
// Apply the perks for the current level.
function xpPerks() {
  const L = xpL();
  CO_MAX.m = L >= 5 ? 30 : 20;
  CO_MAX.i = L >= 5 ? 8 : 5;
  const p = $("lv");
  if (p) p.classList.toggle("gold", L >= 15);
  if (TH === "i" && L < 10) TH = "d";
  // Refresh the theme button and Wick's cap when level 10 is crossed.
  if (L >= 10 !== xpU) {
    xpU = L >= 10;
    thApply();
    if (typeof coMkApply === "function") coMkApply();
  }
}
// Level 10 perks were on at the last check.
let xpU = null;
// Next theme for the theme button: light, dark, then Forest when unlocked.
function thNext() {
  TH = TH === "l" ? "d" : TH === "d" && inkOk() ? "i" : "l";
  thApply();
}
// Wick's cap, drawn on top of the coach character (viewBox 0 0 120 150).
const XCAP =
  '<path d="M28 44Q28 14 60 14Q92 14 92 44Z" fill="#5a3fc0"/><path d="M86 40h22a5 5 0 0 1 0 10H86z" fill="#4a32a8"/><circle cx="60" cy="16" r="4" fill="#4a32a8"/>';
const coAv0 = coAv;
coAv = (m, h) => {
  const s = coAv0(m, h);
  return capOn() ? s.replace(/<\/svg>$/, XCAP + "</svg>") : s;
};
// Celebrate a new perk after the level-up message.
const gamify0 = gamify;
gamify = () => {
  const b = lastL;
  gamify0();
  xpPerks();
  const a = lastL;
  if (b == null || a == null || a <= b) return;
  const k = XPK.filter(p => p[0] > b && p[0] <= a).pop();
  if (k) setTimeout(() => toast("New perk: " + k[1]), 2600);
};
// The XP window.
function xpOpen() {
  if ($("xpw")) return;
  const g = gx(),
    L = g.L,
    nx = XPK.find(p => p[0] > L),
    pc = Math.max(0, Math.min(100, ((g.xp - g.lo) / (g.hi - g.lo)) * 100)),
    rows = XPK.map(p => {
      const on = L >= p[0],
        st = on ? (p[3] === "later" ? "Coming with paid plans" : "Unlocked ✓") : "Locked";
      return `<li class="xpr${on ? " on" : ""}"><span class="xpn">Level ${p[0]}</span><span class="xpb"><b>${p[1]}</b><small>${p[2]}</small></span><span class="xps">${st}</span></li>`;
    }).join(""),
    earn = [
      ["Trade logged", 10],
      ["Reason for entry written", 10],
      ["Reason for exit written", 10],
      ["Exit type chosen", 5],
      ["Stop-loss set", 5],
      ["Stock on the watchlist", 2],
      ["Day with a completed Daily pulse", 15],
      ["Building your own questions (once)", 25]
    ]
      .map(r => `<tr><td>${r[0]}</td><td data-nt>+${r[1]}</td></tr>`)
      .join(""),
    set =
      L >= 10
        ? `<div class="xpset"><button class="gh sm" type="button" data-xp="th">${TH === "i" ? "Turn off the Forest theme" : "Use the Forest theme"}</button><button class="gh sm" type="button" data-xp="cap">${capOn() ? "Hide Wick's cap" : "Show Wick's cap"}</button></div>`
        : "";
  const w = document.createElement("div");
  w.id = "xpw";
  w.className = "xpw";
  w.innerHTML = `<div class="xpd" role="dialog" aria-modal="true" aria-labelledby="xph"><button class="coib xpx" type="button" data-xp="x" aria-label="Close">${CO_SVG.x}</button><h2 id="xph">XP, levels and perks</h2>
<p class="xpl"><b>Level ${L} · ${TT[Math.min(L - 1, TT.length - 1)]}</b><span data-nt dir="ltr">${g.xp} XP</span></p>
<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pc)}"><i style="width:${pc}%"></i></div>
<p class="mut sm">${g.hi - g.xp} XP to level ${L + 1}</p>
<p class="xpnx">${nx ? `Next perk at level ${nx[0]}: ${nx[1]}` : "All perks unlocked. You are a Legend."}</p>
<p class="mut sm">Every 5 levels unlock a perk. You earn XP for good trading habits, not for profit.</p>
<ul class="xpls">${rows}</ul>${set}
<h3>How to earn XP</h3><table class="xpt"><tbody>${earn}</tbody></table>
<p class="mut sm">XP are counted from what is in your journal, so deleting trades also removes their XP.</p></div>`;
  document.body.appendChild(w);
  if (typeof trDom === "function") trDom(w);
  w.querySelector(".xpx").focus();
}
// Close the XP window.
function xpClose() {
  const w = $("xpw");
  if (w) w.remove();
  const p = $("lv");
  if (p) p.focus();
}
document.addEventListener("click", e => {
  if (e.target.closest("#lv") || e.target.closest("[data-xpo]")) return xpOpen();
  const w = $("xpw");
  if (!w) return;
  const b = e.target.closest("[data-xp]");
  if (e.target === w || (b && b.dataset.xp === "x")) return xpClose();
  if (!b) return;
  if (b.dataset.xp === "th") {
    TH = TH === "i" ? "d" : "i";
    thApply();
  } else if (b.dataset.xp === "cap") {
    try {
      localStorage.setItem("tj_cap", capOn() ? "0" : "1");
    } catch (e) {}
    if (typeof coMkApply === "function") coMkApply();
    view();
  }
  xpClose();
  xpOpen();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("xpw")) xpClose();
  if ((e.key === "Enter" || e.key === " ") && e.target.id === "lv") {
    e.preventDefault();
    xpOpen();
  }
});
// Make the level pill a button.
(() => {
  const p = $("lv");
  if (!p) return;
  p.setAttribute("role", "button");
  p.setAttribute("tabindex", "0");
  p.setAttribute("aria-haspopup", "dialog");
  p.setAttribute("title", "XP, levels and perks");
})();
Object.assign(HE, {
  "More from Wick": "יותר מ-Wick",
  "30 messages and 8 chart images a day with Wick, instead of 20 and 5.":
    "30 הודעות ו-8 גרפים ביום עם Wick, במקום 20 ו-5.",
  "Forest theme and Wick's cap": "ערכת היער וכובע ל-Wick",
  "Unlock the Forest color theme and a cap for Wick.": "פותחים את ערכת הצבעים 'יער' וכובע ל-Wick.",
  "Gold star": "כוכב זהב",
  "A gold star next to your level. Later also a discount on paid plans.":
    "כוכב זהב ליד הרמה שלך. בהמשך גם הנחה על תוכניות בתשלום.",
  "Free month": "חודש חינם",
  "A free month of a paid plan, when paid plans launch.":
    "חודש חינם בתוכנית בתשלום, כשהתוכניות בתשלום ייפתחו.",
  "Coming with paid plans": "יגיע עם התוכניות בתשלום",
  "Unlocked ✓": "נפתח ✓",
  "Locked": "נעול",
  "XP, levels and perks": "רמות, הטבות ו-XP",
  "All perks unlocked. You are a Legend.": "כל ההטבות נפתחו. אתה אגדה.",
  "Every 5 levels unlock a perk. You earn XP for good trading habits, not for profit.":
    "כל 5 רמות נפתחת הטבה. מקבלים XP על הרגלי מסחר טובים, לא על רווח.",
  "How to earn XP": "איך צוברים XP",
  "XP are counted from what is in your journal, so deleting trades also removes their XP.":
    "ה-XP נספרות ממה שיש ביומן, ולכן מחיקת עסקאות מורידה גם את ה-XP שלהן.",
  "Use the Forest theme": "הפעל את ערכת היער",
  "Turn off the Forest theme": "כבה את ערכת היער",
  "Hide Wick's cap": "הסר את הכובע של Wick",
  "Show Wick's cap": "הצג את הכובע של Wick",
  "Forest": "יער",
  "XP levels and perks": "רמות XP והטבות",
  "Close": "סגור"
});
HR.push(
  [/^(\d+) XP to level (\d+)$/, x => "עוד \u2066" + x[1] + " XP\u2069 לרמה " + x[2]],
  [/^Next perk at level (\d+): (.+)$/, x => "ההטבה הבאה ברמה " + x[1] + ": " + trc(x[2])],
  [/^Level (\d+)$/, x => "רמה " + x[1]],
  [/^New perk: (.+)$/, x => "הטבה חדשה: " + trc(x[1])]
);
