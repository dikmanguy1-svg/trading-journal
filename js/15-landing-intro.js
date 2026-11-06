/*
 * 15-landing-intro.js — part of the TradeInk app script.
 *
 * Landing page, part 1 (for visitors who are not logged in).
 * - lsChart(): the small candle chart. Phone menu (☰) open/close.
 * - hsInit / hsDots / hsCenter: swipe rows with dots on phones.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

HR.push(
  [/^(\d+) \/ (\d+) today$/, x => x[1] + " מתוך " + x[2] + " היום"],
  [
    /^(\d+) of (\d+) chart images left today · Crop out account numbers first\.$/,
    x => "נשארו היום " + x[1] + " מתוך " + x[2] + " גרפים · חתוך מספרי חשבון לפני ההעלאה."
  ],
  [/^([A-Z0-9.\-]{1,10}) trade$/, x => "עסקת " + x[1]],
  [/^Ask Wick about (.+)$/, x => "שאל את Wick על " + x[1]],
  [/^Remove: (.+)$/, x => "הסר: " + trc(x[1])],
  [/^Add back: (.+)$/, x => "החזר: " + trc(x[1])],
  [/^\+ (Trades|Strategy|Risk settings|Daily pulse)$/, x => "+ " + trc(x[1])]
);
/* ---- Landing page scroll story (logged-out visitors only). The old landing was removed on 1.11 (it is in git history, before commit "Landing page: scroll story"). ---- */
// Candle data for the landing chart.
const LSC = [
  [70, 62, 74, 58],
  [62, 55, 65, 50],
  [56, 46, 58, 42],
  [47, 40, 50, 35],
  [41, 44, 48, 38],
  [44, 40, 46, 36],
  [40, 48, 51, 38],
  [48, 56, 58, 46],
  [56, 53, 60, 50],
  [53, 63, 66, 51],
  [63, 72, 75, 61],
  [72, 69, 76, 66],
  [69, 80, 83, 67],
  [80, 90, 93, 78]
];
// Reduce motion is on.
const lsRM = () =>
  document.documentElement.classList.contains("ay-m") ||
  matchMedia("(prefers-reduced-motion: reduce)").matches;
// The landing page candle chart (SVG).
function lsChart() {
  const W = 300,
    H = 140,
    p = 10,
    n = LSC.length,
    st = (W - 2 * p) / n,
    bw = st * 0.56,
    lo = 35,
    hi = 93,
    y = v => p + ((hi - v) * (H - 2 * p)) / (hi - lo);
  let s = "";
  [0.25, 0.5, 0.75].forEach(
    f => (s += `<line x1="0" x2="${W}" y1="${H * f}" y2="${H * f}" stroke="var(--line)"/>`)
  );
  s += `<line x1="0" x2="${W}" y1="${y(70)}" y2="${y(70)}" stroke="var(--mut)" stroke-dasharray="4 4"/>`;
  LSC.forEach(([o, c, h, l], i) => {
    const x = p + i * st + st / 2,
      col = c >= o ? "var(--g)" : "var(--r)",
      t = y(Math.max(o, c)),
      b = y(Math.min(o, c));
    s += `<g class="ls-cd"><line x1="${x}" x2="${x}" y1="${y(h)}" y2="${y(l)}" stroke="${col}" stroke-width="2" stroke-linecap="round"/><rect x="${x - bw / 2}" y="${t}" width="${bw}" height="${Math.max(b - t, 2)}" rx="2" fill="${col}"/></g>`;
  });
  return `<svg class="ls-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${s}</svg>`;
}

/* Phone: one menu button for the header settings; swipe rows (steps, plans) with dots */
document.addEventListener("click", e => {
  const m = $("mnu"),
    tr = m && m.parentElement;
  if (!m) return;
  if (e.target.closest("#mnu")) {
    const o = !tr.classList.contains("open");
    tr.classList.toggle("open", o);
    m.setAttribute("aria-expanded", String(o));
    return;
  }
  if (
    tr.classList.contains("open") &&
    (!e.target.closest("#trm") || e.target.closest("#trm button"))
  ) {
    tr.classList.remove("open");
    m.setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    const m = $("mnu");
    if (m && m.parentElement.classList.contains("open")) {
      m.parentElement.classList.remove("open");
      m.setAttribute("aria-expanded", "false");
      m.focus();
    }
  }
});
// Dots under swipe rows (phones).
function hsDots() {
  document.querySelectorAll(".hsnap").forEach(sc => {
    let d = sc.nextElementSibling;
    if (!d || !d.classList.contains("hsd")) {
      d = document.createElement("div");
      d.className = "hsd";
      d.setAttribute("aria-hidden", "true");
      sc.after(d);
    }
    const it = [...sc.children].filter(x => x.offsetWidth),
      R = sc.getBoundingClientRect(),
      c = R.left + R.width / 2;
    let bi = 0,
      bd = 1e9;
    it.forEach((x, i) => {
      const r = x.getBoundingClientRect(),
        dd = Math.abs(r.left + r.width / 2 - c);
      if (dd < bd) {
        bd = dd;
        bi = i;
      }
    });
    d.innerHTML = it.map((_, i) => `<i${i === bi ? ' class="on"' : ""}></i>`).join("");
  });
}
// Scroll a swipe row to an item.
function hsCenter(sc, el) {
  if (!sc || !el) return;
  const a = sc.getBoundingClientRect(),
    b = el.getBoundingClientRect();
  sc.scrollLeft += b.left + b.width / 2 - (a.left + a.width / 2);
}
document.addEventListener(
  "scroll",
  e => {
    const t = e.target;
    if (t && t.classList && t.classList.contains("hsnap")) {
      hsDots();
      if (document.querySelector(".ls")) lsFrame();
    }
  },
  true
);
// Turn rows into swipe rows on phones.
function hsInit() {
  const mob = matchMedia("(max-width:760px)").matches;
  document.querySelectorAll(".ls-steps,.plg").forEach(x => x.classList.toggle("hsnap", mob));
  document.querySelectorAll(".hsd").forEach(d => {
    if (!mob) d.remove();
  });
  if (mob) {
    hsCenter(document.querySelector(".plg"), document.querySelector(".plc.rec"));
    hsDots();
  }
}
addEventListener("resize", () => {
  if (document.querySelector(".ls")) hsInit();
});
