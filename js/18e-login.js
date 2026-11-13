/*
 * 18e-login.js — part of the TradeInk app script.
 *
 * The sign-in window (12.11): log in or create an account with email and password,
 * or continue with Google. "Remember me", "Forgot password?" and show/hide password.
 * js/11 opens it from the Log in / Sign up buttons (fbm = the loaded Firebase parts).
 * Looks: css/12-login.css (green top, soft cream sheet, like the site). Email sign-in must be turned on in the Firebase console
 * (Authentication > Sign-in method > Email/Password).
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// The sign-in window state: mode is "in" (log in) or "up" (create an account).
let LG = null;
// Friendly messages for Firebase sign-in errors.
const LGE = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/user-not-found": "Wrong email or password.",
  "auth/invalid-login-credentials": "Wrong email or password.",
  "auth/email-already-in-use": "This email already has an account. Log in instead.",
  // New accounts need 8+ characters (Firebase password policy, 13.11).
  "auth/weak-password": "The password needs at least 8 characters.",
  "auth/password-does-not-meet-requirements": "The password needs at least 8 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/missing-password": "Please enter your password.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
  "auth/network-request-failed": "No connection. Check your internet and try again.",
  "auth/operation-not-allowed": "Email sign-in is not turned on yet. Use Google for now."
};
// Small line icons for the fields.
const LGI = {
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  g: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'
};
// Open the sign-in window.
function lgOpen(mode) {
  if (LG || !fbm) return;
  LG = { mode: mode === "up" ? "up" : "in", back: document.activeElement, busy: false };
  const d = document.createElement("div");
  d.id = "lgw";
  document.body.appendChild(d);
  document.body.classList.add("lg-on");
  lgDraw();
}
// Draw (or redraw) the window for the current mode.
function lgDraw() {
  const d = $("lgw");
  if (!d || !LG) return;
  const up = LG.mode === "up",
    em = ($("lge") || {}).value || "";
  d.innerHTML = `<div class="lgov" data-lgx></div><div class="lgd" role="dialog" aria-modal="true" aria-labelledby="lgh">
<div class="lgtop"><button type="button" class="lglang" id="lglang">${LANG === "he" ? "English" : "עברית"}</button><span class="lgbrand" data-nt>${coAv("pleased", 30)}<b>Trade<i>.</i>Ink</b></span><button type="button" class="lgx" data-lgx aria-label="Close">×</button></div>
<h2 id="lgh">${up ? "Create your account" : "Welcome back"}</h2>
<p class="lgsub">${up ? "Start your trading journal. It takes a minute." : "Log in to see your journal."}</p>
<div class="lgsh"><form id="lgf" novalidate>
 <label class="lgfld">${LGI.mail}<span class="vh">Email</span><input id="lge" type="email" autocomplete="email" inputmode="email" placeholder="Enter your email" required value="${esc(em)}"></label>
 <label class="lgfld">${LGI.lock}<span class="vh">Password</span><input id="lgp" type="password" autocomplete="${up ? "new-password" : "current-password"}" placeholder="${up ? "Choose a password (8+ characters)" : "Enter your password"}" required minlength="${up ? 8 : 6}"><button type="button" class="lgeye" id="lgeye" aria-label="Show password" aria-pressed="false">${LGI.eye}</button></label>
 <div class="lgrow"><label class="lgrem"><input type="checkbox" id="lgr" checked> <span>Remember me</span></label>${up ? "" : '<button type="button" class="lglink" id="lgfg">Forgot password?</button>'}</div>
 <p class="lgmsg" id="lgmsg" role="alert"></p>
 <button type="submit" class="lgbtn" id="lgok">${up ? "Create account" : "Log in"}</button>
</form>
<div class="lgor"><span>Or</span></div>
<button type="button" class="lggo" id="lggo">${LGI.g}<span>Continue with Google</span></button>
<p class="lgsw">${up ? "Already have an account?" : "Don't have an account?"} <button type="button" class="lglink" id="lgsw">${up ? "Log in" : "Create an account"}</button></p>
<p class="lgfine">By continuing you agree to our terms: <a href="terms.html">Terms of Use</a> · <a href="privacy.html">Privacy Policy</a></p>
</div></div>`;
  lgWire();
  setTimeout(() => {
    const i = $(em ? "lgp" : "lge");
    if (i) i.focus();
  }, 30);
}
// Connect the buttons in the window.
function lgWire() {
  const d = $("lgw");
  d.querySelectorAll("[data-lgx]").forEach(b => (b.onclick = lgClose));
  d.onkeydown = e => {
    if (e.key === "Escape") lgClose();
    // Keep Tab inside the window.
    if (e.key === "Tab") {
      const f = [...d.querySelectorAll("button,input,a")].filter(
        x => !x.disabled && x.offsetParent
      );
      if (!f.length) return;
      const a = f[0],
        z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) (e.preventDefault(), z.focus());
      else if (!e.shiftKey && document.activeElement === z) (e.preventDefault(), a.focus());
    }
  };
  $("lgeye").onclick = () => {
    const p = $("lgp"),
      sh = p.type === "password";
    p.type = sh ? "text" : "password";
    $("lgeye").setAttribute("aria-pressed", String(sh));
    $("lgeye").setAttribute("aria-label", tr(sh ? "Hide password" : "Show password"));
  };
  $("lgsw").onclick = () => {
    LG.mode = LG.mode === "up" ? "in" : "up";
    lgDraw();
  };
  $("lglang").onclick = () => $("lg").click();
  $("lggo").onclick = lgGoogle;
  if ($("lgfg")) $("lgfg").onclick = lgForgot;
  $("lgf").onsubmit = e => {
    e.preventDefault();
    lgEmail();
  };
}
// Close the window and go back to where the user was.
function lgClose() {
  const d = $("lgw");
  if (d) d.remove();
  document.body.classList.remove("lg-on");
  const b = LG && LG.back;
  LG = null;
  if (b && b.focus) b.focus();
}
// Show a message in the window (ok = green, otherwise red).
function lgMsg(m, ok) {
  const e = $("lgmsg");
  if (!e) return;
  e.textContent = m ? tr(m) : "";
  e.classList.toggle("ok", !!ok);
}
// Busy state while Firebase works.
function lgBusy(on) {
  if (!LG) return;
  LG.busy = on;
  ["lgok", "lggo"].forEach(id => {
    const b = $(id);
    if (b) b.disabled = on;
  });
}
const lgErr = e => LGE[e && e.code] || "Sign-in did not finish. Try again.";
// "Remember me": stay signed in on this device, or only until the browser closes.
async function lgKeep() {
  const au = fbm.au,
    r = $("lgr");
  await au.setPersistence(
    fbm.auth,
    r && !r.checked ? au.browserSessionPersistence : au.browserLocalPersistence
  );
}
// Log in or create an account with email and password.
async function lgEmail() {
  if (!LG || LG.busy) return;
  const em = $("lge").value.trim(),
    pw = $("lgp").value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return lgMsg("Please enter a valid email address.");
  // New accounts: 8+ characters. Log in: older accounts may still have 6 or 7.
  if (LG.mode === "up" && pw.length < 8) return lgMsg("The password needs at least 8 characters.");
  if (pw.length < 6) return lgMsg("The password needs at least 6 characters.");
  lgMsg("");
  lgBusy(true);
  try {
    await lgKeep();
    if (LG.mode === "up") await fbm.au.createUserWithEmailAndPassword(fbm.auth, em, pw);
    else await fbm.au.signInWithEmailAndPassword(fbm.auth, em, pw);
    lgClose();
  } catch (e) {
    lgBusy(false);
    lgMsg(lgErr(e));
  }
}
// Continue with Google.
async function lgGoogle() {
  if (!LG || LG.busy) return;
  lgMsg("");
  lgBusy(true);
  try {
    await lgKeep();
    await fbm.au.signInWithPopup(fbm.auth, new fbm.au.GoogleAuthProvider());
    lgClose();
  } catch (e) {
    lgBusy(false);
    if (!/popup-closed|cancelled-popup/.test((e && e.code) || "")) lgMsg(lgErr(e));
  }
}
// Send a password reset link to the email in the field.
async function lgForgot() {
  const em = $("lge").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
    return lgMsg("Type your email above, then press Forgot password? again.");
  try {
    await fbm.au.sendPasswordResetEmail(fbm.auth, em);
  } catch (e) {
    if (!/user-not-found/.test((e && e.code) || "")) return lgMsg(lgErr(e));
  }
  // Same message either way, so the window does not tell who has an account.
  lgMsg("If this email has an account, a reset link is on its way. Check your inbox.", true);
}
