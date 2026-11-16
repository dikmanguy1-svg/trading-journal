/*
 * 18l-select.js — part of the TradeInk app script.
 *
 * Inviting drop-down lists (16.11). The computer's own list (gray, plain) is replaced
 * by a TradeInk list: cream sheet, purple choice, a check mark on the chosen line.
 * Works for every <select> on the site, also new ones, with no change to them:
 * mouse, and keyboard (Enter / Space / Alt+Down to open, arrows, Home/End, type a letter to jump,
 * Enter to choose, Escape to close). The <select> keeps its value and gets the normal
 * "change" event, so all the code that listens to it keeps working.
 * Phones and tablets (touch) keep the phone's own picker, which is easier with a finger.
 * High contrast (.ay-c) keeps the plain list. Looks: css/13-ink-paper.css (".sel...").
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// The open list: { s: the <select>, w: the list element, i: the highlighted line }.
let SEL = null;
const selOk = s =>
  s &&
  s.tagName === "SELECT" &&
  !s.multiple &&
  !s.disabled &&
  (s.size || 0) <= 1 &&
  !document.documentElement.classList.contains("ay-c") &&
  matchMedia("(pointer: fine)").matches;

function selClose(back) {
  if (!SEL) return;
  SEL.w.remove();
  SEL.s.setAttribute("aria-expanded", "false");
  const s = SEL.s;
  SEL = null;
  if (back && s.isConnected) s.focus();
}
// Highlight line i (and keep it in view).
function selMark(i) {
  const L = [...SEL.w.querySelectorAll("[role=option]:not([aria-disabled=true])")];
  if (!L.length) return;
  i = Math.max(0, Math.min(L.length - 1, i));
  L.forEach((o, k) => o.classList.toggle("hi", k === i));
  SEL.i = i;
  L[i].scrollIntoView({ block: "nearest" });
  SEL.w.setAttribute("aria-activedescendant", L[i].id);
}
// Choose line i: set the value and tell the page.
function selPick(i) {
  const L = [...SEL.w.querySelectorAll("[role=option]:not([aria-disabled=true])")],
    o = L[i],
    s = SEL.s;
  if (!o) return selClose(true);
  const v = o.dataset.v;
  selClose(true);
  if (s.value !== v) {
    s.value = v;
    s.dispatchEvent(new Event("input", { bubbles: true }));
    s.dispatchEvent(new Event("change", { bubbles: true }));
    // The page may redraw: put the cursor back on the same box.
    if (!s.isConnected) {
      const k = ["id", "data-k", "data-fx", "data-tp", "name"].find(a => s.getAttribute(a));
      const n = k && document.querySelector(`select[${k}="${CSS.escape(s.getAttribute(k))}"]`);
      if (n) n.focus();
    }
  }
}

function selOpen(s) {
  selClose();
  const r = s.getBoundingClientRect(),
    w = document.createElement("div"),
    opts = [...s.options];
  w.className = "selw";
  w.setAttribute("role", "listbox");
  w.tabIndex = -1;
  if (s.getAttribute("aria-label")) w.setAttribute("aria-label", s.getAttribute("aria-label"));
  w.innerHTML = opts
    .map(
      (o, k) =>
        `<div role="option" id="selo${k}" data-v="${esc(o.value)}" aria-selected="${o.selected}"${o.disabled ? ' aria-disabled="true"' : ""}${o.hidden ? " hidden" : ""} data-nt><span class="selc" aria-hidden="true">${o.selected ? "✓" : ""}</span>${esc(o.textContent)}</div>`
    )
    .join("");
  document.body.appendChild(w);
  // Under the box, or above it when there is no room below.
  const h = Math.min(w.scrollHeight, 340),
    below = innerHeight - r.bottom - 12,
    up = below < Math.min(h, 220) && r.top > below;
  w.style.minWidth = Math.max(r.width, 160) + "px";
  w.style.maxHeight = Math.max(140, Math.min(340, up ? r.top - 12 : below)) + "px";
  w.style.top = (up ? Math.max(8, r.top - Math.min(h, r.top - 12) - 6) : r.bottom + 6) + "px";
  const left = Math.min(r.left, innerWidth - w.offsetWidth - 8);
  w.style.left = Math.max(8, document.dir === "rtl" ? r.right - w.offsetWidth : left) + "px";
  s.setAttribute("aria-expanded", "true");
  SEL = { s, w, i: 0 };
  const en = [...w.querySelectorAll("[role=option]:not([aria-disabled=true])")];
  selMark(
    Math.max(
      0,
      en.findIndex(o => o.getAttribute("aria-selected") === "true")
    )
  );
}

// Open on mouse press (instead of the computer's list).
document.addEventListener(
  "mousedown",
  e => {
    const s = e.target.closest && e.target.closest("select");
    if (SEL && !SEL.w.contains(e.target)) {
      const same = SEL.s === s;
      selClose();
      if (same) return e.preventDefault();
    }
    if (!selOk(s)) return;
    e.preventDefault();
    s.focus();
    selOpen(s);
  },
  true
);
// Choose with the mouse.
document.addEventListener("click", e => {
  const o = SEL && e.target.closest && e.target.closest(".selw [role=option]");
  if (!o || o.getAttribute("aria-disabled") === "true") return;
  const L = [...SEL.w.querySelectorAll("[role=option]:not([aria-disabled=true])")];
  selPick(L.indexOf(o));
});
document.addEventListener("mouseover", e => {
  const o = SEL && e.target.closest && e.target.closest(".selw [role=option]");
  if (!o) return;
  const L = [...SEL.w.querySelectorAll("[role=option]:not([aria-disabled=true])")],
    i = L.indexOf(o);
  if (i >= 0 && i !== SEL.i) {
    L.forEach((x, k) => x.classList.toggle("hi", k === i));
    SEL.i = i;
  }
});
// Keyboard.
let selTyped = "",
  selTypedT = 0;
document.addEventListener(
  "keydown",
  e => {
    const s = e.target;
    if (!SEL) {
      if (!selOk(s)) return;
      if (
        e.key === "Enter" ||
        e.key === " " ||
        (e.altKey && e.key === "ArrowDown") ||
        e.key === "F4"
      ) {
        e.preventDefault();
        selOpen(s);
      }
      return;
    }
    const n = SEL.w.querySelectorAll("[role=option]:not([aria-disabled=true])").length;
    const go = i => (e.preventDefault(), e.stopPropagation(), selMark(i));
    if (e.key === "ArrowDown") return go(SEL.i + 1);
    if (e.key === "ArrowUp") return go(SEL.i - 1);
    if (e.key === "Home") return go(0);
    if (e.key === "End") return go(n - 1);
    if (e.key === "PageDown") return go(SEL.i + 8);
    if (e.key === "PageUp") return go(SEL.i - 8);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      return selPick(SEL.i);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      return selClose(true);
    }
    if (e.key === "Tab") return selClose();
    // Type letters to jump to a line.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      selTyped = (Date.now() - selTypedT < 700 ? selTyped : "") + e.key.toLowerCase();
      selTypedT = Date.now();
      const L = [...SEL.w.querySelectorAll("[role=option]:not([aria-disabled=true])")],
        k = L.findIndex(o =>
          o.textContent.replace("✓", "").trim().toLowerCase().startsWith(selTyped)
        );
      if (k >= 0) selMark(k);
    }
  },
  true
);
// Scrolling the page, resizing or redrawing closes the list.
addEventListener("resize", () => selClose());
document.addEventListener(
  "scroll",
  e => {
    if (SEL && !SEL.w.contains(e.target)) selClose();
  },
  true
);
setInterval(() => {
  if (SEL && !SEL.s.isConnected) selClose();
}, 500);
