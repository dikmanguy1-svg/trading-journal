/*
 * 09-theme-accessibility.js — part of the TradeInk app script.
 *
 * Light / dark theme and the Accessibility menu
 * (text size, high contrast, underline links, reduce motion).
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Theme: "l" light, "d" dark (ink blue) or "i" Forest green (saved on this device).
var TH = (() => {
  try {
    const v = localStorage.getItem("tj_theme");
    return v === "d" || v === "i" ? v : "l";
  } catch (e) {
    return "l";
  }
})();
// Apply the theme.
function thApply() {
  document.documentElement.classList.toggle("th-l", TH === "l");
  document.documentElement.classList.toggle("th-i", TH === "i");
  const b = $("th");
  if (b)
    b.textContent =
      TH === "l"
        ? "Dark"
        : TH === "d" && typeof inkOk === "function" && inkOk()
          ? "Forest"
          : "Light";
  try {
    localStorage.setItem("tj_theme", TH);
  } catch (e) {}
}
// Device storage key for the accessibility settings.
const AYK = "tj_a11y";
// Accessibility settings.
let AY = { z: 0, c: 0, u: 0, m: 0 };
// Read saved accessibility settings from this device.
try {
  const o = JSON.parse(localStorage.getItem(AYK) || "{}");
  AY = { z: Math.max(0, Math.min(3, o.z | 0)), c: o.c ? 1 : 0, u: o.u ? 1 : 0, m: o.m ? 1 : 0 };
} catch (e) {}
// Apply the accessibility settings.
function ayApply() {
  const h = document.documentElement;
  h.classList.toggle("ay-c", !!AY.c);
  h.classList.toggle("ay-u", !!AY.u);
  h.classList.toggle("ay-m", !!AY.m);
  h.style.setProperty("--ayz", [1, 1.15, 1.3, 1.5][AY.z]);
  $("ayc").checked = !!AY.c;
  $("ayu").checked = !!AY.u;
  $("aym2").checked = !!AY.m;
  try {
    localStorage.setItem(AYK, JSON.stringify(AY));
  } catch (e) {}
}
// Connect the Accessibility menu.
function ayInit() {
  const m = $("aym"),
    b = $("ay"),
    op = o => {
      m.hidden = !o;
      b.setAttribute("aria-expanded", o ? "true" : "false");
      if (o) $("ayx").focus();
      else b.focus();
    };
  b.onclick = () => op(m.hidden);
  $("ayx").onclick = () => op(false);
  m.addEventListener("keydown", e => {
    if (e.key === "Escape") op(false);
  });
  $("ayp").onclick = () => {
    AY.z = Math.min(3, AY.z + 1);
    ayApply();
  };
  $("ays").onclick = () => {
    AY.z = Math.max(0, AY.z - 1);
    ayApply();
  };
  $("ayc").onchange = e => {
    AY.c = e.target.checked ? 1 : 0;
    ayApply();
  };
  $("ayu").onchange = e => {
    AY.u = e.target.checked ? 1 : 0;
    ayApply();
  };
  $("aym2").onchange = e => {
    AY.m = e.target.checked ? 1 : 0;
    ayApply();
  };
  $("ayr").onclick = () => {
    AY = { z: 0, c: 0, u: 0, m: 0 };
    ayApply();
  };
  ayApply();
}
