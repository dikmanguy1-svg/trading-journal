/*
 * 18f-backup.js — part of the TradeInk app script.
 *
 * Backup and restore of the user's OWN data (one JSON file on their device).
 * - What goes in: everything the user entered (trades, watchlist, strategy, questions,
 *   rules, long-term holdings, XP...). Price keys and the price cache stay out.
 * - Nothing about the site itself (code, design) and nothing of other users.
 * - Restore: the file is read on the device, checked with clean(), shown as a short
 *   summary, and only replaces the data after the user presses "Restore".
 *   The data from before the restore is kept in memory so it can be undone.
 * - The card is drawn by view() on the Trade journal tab (bkCard()).
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Backup state: BK = a backup file read and waiting for "Restore"; BKU = data before the last restore (for Undo).
var BK = null,
  BKU = null;

// Fields that belong to this device, not to the user's data.
const BKX = ["key", "keyBad", "td", "tdBad", "px", "pxT", "sma", "smaT"];

// A copy of the user's data without device-only fields.
function bkData() {
  const o = JSON.parse(JSON.stringify(S));
  for (const k of BKX) delete o[k];
  return o;
}

// Short counts for the summary line.
function bkCount(d) {
  const tr = Array.isArray(d.trades) ? d.trades : [];
  return {
    trades: tr.length,
    open: tr.filter(t => t.x == null).length,
    wl: Array.isArray(d.wl) ? d.wl.length : 0,
    lt: d.lt && Array.isArray(d.lt.h) ? d.lt.h.length : 0,
    rules: Array.isArray(d.rules) ? d.rules.length : 0
  };
}

// Counts as one readable line.
function bkLine(c) {
  const he = LANG === "he";
  return he
    ? `${c.trades} עסקאות (${c.open} פתוחות) · ${c.wl} ברשימת מעקב · ${c.lt} החזקות לטווח ארוך · ${c.rules} חוקים`
    : `${c.trades} trades (${c.open} open) · ${c.wl} on the watchlist · ${c.lt} long-term holdings · ${c.rules} rules`;
}

// Download the backup file.
function bkDownload() {
  const now = new Date(),
    file = {
      app: "TradeInk",
      kind: "backup",
      v: 1,
      at: now.toISOString(),
      data: bkData()
    },
    a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
  a.download = "tradeink-backup-" + dkey(now) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(LANG === "he" ? "הגיבוי ירד למכשיר שלך" : "Backup downloaded to your device");
}

// Read a backup file chosen by the user. Accepts new files ({app, data}) and old ones (plain state).
async function bkRead(f) {
  BK = null;
  try {
    if (!f || f.size > 5e6) throw 0;
    const j = JSON.parse(await f.text()),
      d = j && j.app === "TradeInk" && j.data && typeof j.data === "object" ? j.data : j;
    if (!d || typeof d !== "object" || !Array.isArray(d.trades)) throw 0;
    const n = clean(d),
      at = j && typeof j.at === "string" && /^\d{4}-\d{2}-\d{2}/.test(j.at) ? j.at.slice(0, 10) : "";
    BK = { name: String(f.name || "").slice(0, 120), at, n, c: bkCount(n) };
  } catch (e) {
    BK = { err: 1, name: String((f && f.name) || "").slice(0, 120) };
  }
  view();
}

// Replace the user's data with the backup that was read (keeps this device's price keys and cache).
function bkRestore() {
  if (!BK || !BK.n) return;
  BKU = bkData();
  S = carry(BK.n);
  BK = null;
  save();
  toast(LANG === "he" ? "הנתונים שוחזרו מהגיבוי" : "Your data was restored from the backup");
  view();
}

// Undo the last restore (only during this visit).
function bkUndo() {
  if (!BKU) return;
  S = carry(clean(BKU));
  BKU = null;
  save();
  toast(LANG === "he" ? "השחזור בוטל, הנתונים חזרו" : "Restore undone, your data is back");
  view();
}

// The Backup card on the Trade journal tab.
function bkCard() {
  const he = LANG === "he",
    L = (en, h) => (he ? h : en);
  let body = "";
  if (BK && BK.err)
    body = `<p class="neg" role="alert">${L(
      "This file is not a TradeInk backup, or it is damaged. Choose the .json file you downloaded with “Download backup”.",
      "הקובץ הזה אינו גיבוי של TradeInk, או שהוא פגום. בחר את קובץ ה-json שהורדת עם “הורד גיבוי”."
    )}</p>`;
  else if (BK)
    body = `<div class="bkbox" role="region" aria-label="${L("Backup to restore", "גיבוי לשחזור")}">
<p><b>${esc(BK.name)}</b>${BK.at ? ` · ${L("saved on", "נשמר בתאריך")} ${esc(BK.at)}` : ""}</p>
<p>${L("In the backup", "בגיבוי")}: ${bkLine(BK.c)}</p>
<p>${L("Now in your journal", "כרגע ביומן שלך")}: ${bkLine(bkCount(S))}</p>
<p class="neg"><b>${L(
      "Restoring replaces all your current data with the data in the backup.",
      "שחזור מחליף את כל הנתונים הנוכחיים שלך בנתונים שבגיבוי."
    )}</b> ${L("To be safe, download a backup of your current data first.", "ליתר ביטחון, הורד קודם גיבוי של הנתונים הנוכחיים.")}</p>
<p class="bkbt"><button data-bk="restore">${L("Restore this backup", "שחזר את הגיבוי הזה")}</button> <button class="gh" data-bk="dl">${L("Download current data first", "הורד קודם את הנתונים הנוכחיים")}</button> <button class="gh" data-bk="no">${L("Cancel", "ביטול")}</button></p></div>`;
  const undo = BKU
    ? `<p class="bkbt"><span class="mut sm">${L("Restored by mistake?", "שחזרת בטעות?")}</span> <button class="gh sm" data-bk="undo">${L("Undo the restore", "בטל את השחזור")}</button></p>`
    : "";
  return `<details class="card wlf jimp jbk"${BK || BKU ? " open" : ""}><summary>${L("Backup and restore", "גיבוי ושחזור")}</summary>
<p class="mut">${L(
    "Download one file with all your own data: trades, watchlist, strategy, questions, rules, long-term holdings and progress. It does not include the site itself or anyone else's data. Keep it on your computer, and use it to bring everything back if something is deleted by mistake.",
    "הורד קובץ אחד עם כל הנתונים האישיים שלך: עסקאות, רשימת מעקב, אסטרטגיה, שאלות, חוקים, החזקות לטווח ארוך והתקדמות. הקובץ לא כולל את האתר עצמו או נתונים של אחרים. שמור אותו במחשב, ותוכל להחזיר בעזרתו הכול אם משהו נמחק בטעות."
  )}</p>
<p class="bkbt"><button class="gh" data-bk="dl">${L("Download backup", "הורד גיבוי")}</button> <label class="bl" for="bkf" tabindex="0" role="button">${L("Restore from backup", "שחזר מגיבוי")}</label></p>
${body}${undo}</details>`;
}

// Buttons inside the Backup card.
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-bk]");
  if (!b) return;
  const a = b.dataset.bk;
  if (a === "dl") bkDownload();
  else if (a === "restore") bkRestore();
  else if (a === "undo") bkUndo();
  else if (a === "no") {
    BK = null;
    view();
  }
});

// A backup file was chosen.
document.addEventListener("change", e => {
  if (e.target && e.target.id === "bkf") {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f) bkRead(f);
  }
});

// The file picker for "Restore from backup" lives outside the page area that view() redraws,
// so a price refresh while the file window is open cannot lose the chosen file.
(() => {
  const i = document.createElement("input");
  i.type = "file";
  i.id = "bkf";
  i.accept = ".json,application/json";
  i.className = "vh";
  i.tabIndex = -1;
  i.setAttribute("aria-hidden", "true");
  document.body.appendChild(i);
})();

// Keyboard: Enter or Space on a "choose file" label opens the file window (Import and Backup cards).
document.addEventListener("keydown", e => {
  const l = e.target && e.target.closest && e.target.closest('label.bl[for="imf"], label.bl[for="bkf"]');
  if (!l || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  const i = document.getElementById(l.htmlFor);
  if (i) i.click();
});
