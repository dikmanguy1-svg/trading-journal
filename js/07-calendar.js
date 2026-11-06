/*
 * 07-calendar.js — part of the TradeInk app script.
 *
 * CAL: the custom date picker (centered window, Hebrew and English).
 * Replaces the browser's own date picker for date fields.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// The custom date picker.
const CAL = (() => {
  let el = null,
    w = null,
    inp = null,
    vy = 0,
    vm = 0;
  const loc = LANG === "he" ? "he-IL" : "en-US",
    P = n => String(n).padStart(2, "0"),
    iso = (y, m, d) => y + "-" + P(m + 1) + "-" + P(d);
  function close() {
    if (w) {
      w.remove();
      w = null;
      el = null;
      inp = null;
      document.documentElement.classList.remove("calo");
    }
  }
  function draw() {
    const sel = inp.value,
      t = new Date(),
      ts = iso(t.getFullYear(), t.getMonth(), t.getDate()),
      first = new Date(vy, vm, 1).getDay(),
      dim = new Date(vy, vm + 1, 0).getDate(),
      mn = new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" }).format(
        new Date(vy, vm, 1)
      ),
      wd = [0, 1, 2, 3, 4, 5, 6].map(i =>
        new Intl.DateTimeFormat(loc, { weekday: LANG === "he" ? "narrow" : "short" }).format(
          new Date(2023, 0, 1 + i)
        )
      );
    let c = wd.map(w => "<span>" + w + "</span>").join("");
    for (let i = 0; i < first; i++) c += "<i></i>";
    for (let d = 1; d <= dim; d++) {
      const x = iso(vy, vm, d);
      c +=
        '<button type="button" class="cd' +
        (x === sel ? " on" : "") +
        (x === ts ? " td" : "") +
        '" data-cd="' +
        x +
        '">' +
        d +
        "</button>";
    }
    el.innerHTML =
      '<div class="ch"><button type="button" data-cm="-12" aria-label="Previous year">' +
      (LANG === "he" ? "\u00bb" : "\u00ab") +
      '</button><button type="button" data-cm="-1" aria-label="Previous month">' +
      (LANG === "he" ? "\u203a" : "\u2039") +
      "</button><b>" +
      mn +
      '</b><button type="button" data-cm="1" aria-label="Next month">' +
      (LANG === "he" ? "\u2039" : "\u203a") +
      '</button><button type="button" data-cm="12" aria-label="Next year">' +
      (LANG === "he" ? "\u00ab" : "\u00bb") +
      '</button></div><div class="cg">' +
      c +
      '</div><button type="button" class="ct" data-cd="' +
      ts +
      '">Today</button>';
  }
  function open(i) {
    close();
    inp = i;
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(i.value),
      n = new Date();
    vy = m ? +m[1] : n.getFullYear();
    vm = m ? +m[2] - 1 : n.getMonth();
    w = document.createElement("div");
    w.className = "calw";
    el = document.createElement("div");
    el.className = "cal";
    el.setAttribute("role", "dialog");
    w.appendChild(el);
    document.body.appendChild(w);
    document.documentElement.classList.add("calo");
    draw();
    if (LANG === "he") trDom(el);
  }
  document.addEventListener("click", e => {
    const t = e.target;
    if (t.classList && t.classList.contains("dpk")) {
      open(t);
      return;
    }
    const m = t.closest && t.closest("[data-cm]");
    if (m && el) {
      const d = new Date(vy, vm + +m.dataset.cm, 1);
      vy = d.getFullYear();
      vm = d.getMonth();
      draw();
      if (LANG === "he") trDom(el);
      return;
    }
    const c = t.closest && t.closest("[data-cd]");
    if (c && el) {
      const i = inp;
      i.value = c.dataset.cd;
      close();
      i.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (el && !el.contains(t)) close();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") close();
    else if (
      (e.key === "Enter" || e.key === " ") &&
      e.target.classList &&
      e.target.classList.contains("dpk")
    ) {
      e.preventDefault();
      open(e.target);
    }
  });
  addEventListener("resize", close);
  return { close };
})();
