/*
 * 19-start.js — part of the TradeInk app script.
 *
 * Start-up. Loaded last: everything above must already be defined.
 * Loads saved data, draws the page, starts Firebase, theme, accessibility, language,
 * and refreshes prices every 60 seconds.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

load();
view();
ayInit();
$("th").onclick = () => {
  TH = TH === "l" ? "d" : "l";
  thApply();
};
thApply();
fbInit();
$("pu").value = S.key || "";
$("tu").value = S.td || "";
$("tg").onclick = () => {
  const v = $("tu").value.trim();
  if (!/^[\w-]{10,80}$/.test(v)) {
    $("pxs").textContent = "That key does not look right. Paste it again.";
    return;
  }
  S.td = v;
  S.tdBad = false;
  S.smaT = {};
  try {
    localStorage.setItem(KT, v);
  } catch (e) {}
  save();
  getPx();
};
$("pg").onclick = () => {
  S.key = $("pu").value.trim();
  S.keyBad = false;
  S.pxT = {};
  try {
    localStorage.setItem(KK, S.key);
  } catch (e) {}
  save();
  getPx();
};
setInterval(getPx, 60000);

$("lg").textContent = LANG === "he" ? "English" : "עברית";
$("lg").onclick = () => {
  try {
    localStorage.setItem("tj_lang", LANG === "he" ? "en" : "he");
  } catch (e) {}
  location.reload();
};
// Hebrew: set right-to-left direction and translate the page.
if (LANG === "he") {
  document.documentElement.lang = "he";
  document.documentElement.dir = "rtl";
  trDom(document.body);
  if (typeof MutationObserver !== "undefined")
    new MutationObserver(ms =>
      ms.forEach(m => {
        if (m.type === "characterData") trText(m.target);
        else m.addedNodes.forEach(trDom);
      })
    ).observe(document.body, { childList: true, subtree: true, characterData: true });
}
