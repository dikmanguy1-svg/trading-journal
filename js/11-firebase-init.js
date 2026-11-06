/*
 * 11-firebase-init.js — part of the TradeInk app script.
 *
 * fbInit(): loads Firebase (sign-in with Google and Firestore) from Google's servers
 * and connects the Sign up / Log in button.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Load Firebase from Google and connect sign-in.
async function fbInit() {
  if (!FB) return;
  $("dl").onclick = csvDl;
  $("au").hidden = false;
  try {
    const b = "https://www.gstatic.com/firebasejs/" + FBV + "/",
      [a, au, fs] = await Promise.all([
        import(b + "firebase-app.js"),
        import(b + "firebase-auth.js"),
        import(b + "firebase-firestore.js")
      ]);
    const app = a.initializeApp(FB);
    fbm = { au, fs, auth: au.getAuth(app), db: fs.getFirestore(app) };
    $("au").onclick = async () => {
      try {
        if (U) await au.signOut(fbm.auth);
        else await au.signInWithPopup(fbm.auth, new au.GoogleAuthProvider());
      } catch (e) {
        $("sv").textContent = "Sign-in did not finish. Try again.";
      }
    };
    au.onAuthStateChanged(fbm.auth, onUser);
  } catch (e) {
    $("sv").textContent = "Accounts are unavailable right now.";
    $("au").hidden = true;
  }
}
