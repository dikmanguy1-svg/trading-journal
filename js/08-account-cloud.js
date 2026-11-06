/*
 * 08-account-cloud.js — part of the TradeInk app script.
 *
 * This device, backups and the user's cloud account.
 * - load(): reads data saved on this device.
 * - Export / import backup buttons.
 * - FB: Firebase settings (the apiKey is public by design; Firestore rules protect the data).
 * - cloudSave(): writes the whole journal to Firestore users/{uid}.
 * - onUser(): runs when someone logs in or out; loads their journal.
 * - Mailing list / marketing consent code is switched off (WLON = false).
 * - csvDl(): "Download my data" (trades as CSV, safe against spreadsheet formulas).
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Device storage keys for the user's own price keys.
const KK = "tj_k",
  KT = "tj_td";
// Read data saved on this device.
function load() {
  try {
    const r = localStorage.getItem("tj_v1");
    if (r) {
      if (FB) LOCAL = JSON.parse(r);
      else S = clean(JSON.parse(r));
    }
  } catch (e) {}
  try {
    if (!S.key) {
      const k = localStorage.getItem(KK);
      if (k && /^[\w-]{10,80}$/.test(k)) S.key = k;
    }
    if (!S.td) {
      const k = localStorage.getItem(KT);
      if (k && /^[\w-]{10,80}$/.test(k)) S.td = k;
    }
  } catch (e) {}
}
$("ex").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify({ ...S, key: undefined, keyBad: undefined, td: undefined, tdBad: undefined })
      ],
      { type: "application/json" }
    )
  );
  a.download = "trading-journal-backup.json";
  a.click();
};
$("im").onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (f.size > 3e6 || !Array.isArray(d.trades)) throw 0;
    if (!cf("Replace the data on this device with this backup?")) return;
    const k = S.key,
      k2 = S.td;
    S = clean(d);
    if (k2) S.td = k2;
    if (!S.key && k) S.key = k;
    save();
    view();
  } catch (x) {
    al("This file is not a valid backup.");
  }
  e.target.value = "";
};
/* ---- Accounts (Firebase). Stays hidden until FB is filled in. ---- */
// Firebase settings. The apiKey is public by design.
const FB = {
  apiKey: "AIzaSyAbwXhBp2GW0MJvLUCALKSJ_60AEWOFKeQ",
  authDomain: "trading-journal-58021.firebaseapp.com",
  projectId: "trading-journal-58021",
  storageBucket: "trading-journal-58021.firebasestorage.app",
  messagingSenderId: "140544760726",
  appId: "1:140544760726:web:f63699ccf2bbc2030b5bb7"
};
// Firebase library version.
const FBV = "10.14.1";
// Account state: U = logged-in user.
var LOCAL = null,
  U = null,
  cloudReady = false,
  cloudT = null,
  fbm = null;
// True when there are trades or watchlist rows.
const hasData = d => d.trades.length > 0 || d.wl.length > 0;
// Keep this device's price data when replacing the state.
function carry(n) {
  n.key = S.key;
  n.td = S.td;
  n.px = S.px;
  n.pxT = S.pxT;
  n.sma = S.sma;
  n.smaT = S.smaT;
  return n;
}
// Save the whole journal to Firestore (users/{uid}), 1.2 s after the last change.
function cloudSave() {
  clearTimeout(cloudT);
  $("sv").textContent = "Saving…";
  cloudT = setTimeout(async () => {
    try {
      const { key, keyBad, td, tdBad, px, pxT, sma, smaT, ...d } = S;
      await fbm.fs.setDoc(fbm.fs.doc(fbm.db, "users", U.uid), {
        data: JSON.stringify(d),
        updated: Date.now()
      });
      $("sv").textContent = "Saved ✓";
      $("sv").title = tr("Saved to your account");
    } catch (e) {
      $("sv").textContent = "Could not save to your account";
    }
  }, 1200);
}

// Marketing consent (feature off).
var MK;
// Mailing list switch (off until the Firestore rules allow it).
const WLON = false;
// Mailing list form (feature off).
function wlInit() {
  const f = $("wl");
  if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const m = $("wlm"),
      em = $("wle").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || em.length > 254) {
      m.textContent = "Please enter a valid email.";
      return;
    }
    if (!$("wlc").checked) {
      m.textContent = "Please tick the box to agree to receive updates.";
      return;
    }
    if (!fbm) {
      m.textContent = "Not ready yet. Try again in a moment.";
      return;
    }
    try {
      await fbm.fs.addDoc(fbm.fs.collection(fbm.db, "leads"), {
        email: em,
        consent: true,
        ts: Date.now(),
        lang: LANG
      });
      f.reset();
      m.textContent = "Thank you! You are on the list.";
    } catch (x) {
      m.textContent = "Could not save. Please try again later.";
    }
  };
}
// Marketing consent box (feature off).
function mkRender() {
  const b = $("mk");
  if (!b) return;
  if (!U || MK !== null) {
    b.innerHTML = "";
    return;
  }
  b.innerHTML =
    '<div class="card mkc"><h3>Stay in the loop?</h3><label class="chk"><input type="checkbox" id="mkc"> I agree to receive updates and offers about TradeInk by email. I can unsubscribe at any time.</label><p><button id="mks">Save</button> <button id="mkn" class="ghost">No thanks</button></p></div>';
  const put = async c => {
    try {
      const d = {
        email: String(U.email || "").slice(0, 254),
        consent: c,
        ts: Date.now(),
        lang: LANG
      };
      await fbm.fs.setDoc(fbm.fs.doc(fbm.db, "mkt", U.uid), d);
      MK = d;
      mkRender();
      toast(c ? "Thanks! You will get our updates." : "Saved.");
    } catch (x) {
      toast("Could not save. Try again.");
    }
  };
  $("mks").onclick = () => put($("mkc").checked);
  $("mkn").onclick = () => put(false);
}
// Runs on log in / log out: loads the user's journal or clears the screen.
async function onUser(u) {
  if (u) {
    U = u;
    cloudReady = false;
    $("sv").textContent = "Loading your journal...";
    try {
      const snap = await fbm.fs.getDoc(fbm.fs.doc(fbm.db, "users", u.uid));
      if (snap.exists()) {
        S = carry(clean(JSON.parse(snap.data().data)));
        cloudReady = true;
      } else if (
        LOCAL &&
        hasData(clean(LOCAL)) &&
        cf("Upload the journal saved on this device to your new account?")
      ) {
        S = carry(clean(LOCAL));
        cloudReady = true;
        cloudSave();
      } else {
        S = carry(clean({}));
        cloudReady = true;
        cloudSave();
      }
      try {
        const ms = await fbm.fs.getDoc(fbm.fs.doc(fbm.db, "mkt", u.uid));
        MK = ms.exists() ? ms.data() : null;
      } catch (e2) {
        MK = undefined;
      }
      $("sv").textContent = "Signed in";
    } catch (e) {
      U = null;
      cloudReady = false;
      $("sv").textContent = "Could not load your account. Try again.";
    }
  } else {
    MK = undefined;
    const was = cloudReady;
    U = null;
    cloudReady = false;
    if (was) {
      const k = S.key;
      S = clean({});
      if (k) S.key = k;
    }
    $("sv").textContent = "";
  }
  $("who").textContent = U
    ? String(U.displayName || U.email || "")
        .split(" ")[0]
        .slice(0, 30)
    : "";
  $("au").textContent = U ? "Log out" : "Sign up / Log in";
  $("dl").hidden = !U;
  mkRender();
  view();
}
// Unused placeholder.
function csvDl_placeholder() {}
// Download the trades as CSV (values starting with = + - @ get a ' so Excel will not run them).
function csvDl() {
  const q = v => {
      v = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
      return '"' + v.replace(/"/g, '""') + '"';
    },
    R = [];
  R.push([
    "Date",
    "Ticker",
    "Direction",
    "Entry",
    "Stop",
    "Target",
    "Shares",
    "Exit price",
    "Exit date",
    "Exit type",
    "P&L ($)",
    "Reason for entry",
    "Reason for exit"
  ]);
  S.trades.forEach(t =>
    R.push([
      t.d,
      t.t,
      t.dir,
      t.e,
      t.s,
      t.tg,
      t.sh,
      t.x,
      t.xd,
      t.rs,
      t.x == null ? "" : pnl(t).toFixed(2),
      t.th,
      t.xr
    ])
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + R.map(r => r.map(q).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8"
    })
  );
  a.download = "trading-journal-trades-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
}
