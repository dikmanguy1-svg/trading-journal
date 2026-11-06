# Trading.Journal

A trading journal for swing traders, day traders and long-term investors.
Live site: https://dikmanguy1-svg.github.io/trading-journal/

It is a static site (GitHub Pages). There is **no build step**: the files in this repo are
exactly the files the browser loads. Sign-in and data use Google Firebase (Auth + Firestore);
prices come from Finnhub; the AI coach runs on a small Cloudflare Worker (`worker/`).

## File map

| Path | What it is |
| --- | --- |
| `index.html` | The page frame only: header, empty containers, and the list of CSS and JS files. |
| `css/01-theme-base.css` | Colors (light / dark), background, base layout, accessibility modes. |
| `css/02-landing-plans-menu.css` | Landing page, plans and prices, phone menu, swipe rows, close-trade window. |
| `css/03-interface-layer.css` | Touch feedback, floating tab bar, shadows, window animations. |
| `css/04-components.css` | Buttons, tabs, cards, forms, tables, P&L box, date picker, chips, toast, RTL fixes. |
| `css/05-long-term-panel.css` | Long-term portfolio side panel. |
| `css/06-phone-header.css` | Phone header and tab bar. |
| `css/07-trade-cards.css` | Trade and watchlist cards on phones. |
| `css/08-hero-card.css` | Small candle card at the top. |
| `css/09-landing-scroll.css` | Landing page scroll story. |
| `js/01-core.js` | Frame guard, helpers (`$`, `esc`, `tk`, `$f`), default questions, the state `S`, strategy tools. |
| `js/02-strategy-xp.js` | Strategy tab, question builder, XP / levels / badges / streak. |
| `js/03-language.js` | Hebrew / English (`LANG`, `HE`, `HR`, `tr`, `trDom`). |
| `js/04-questions-state-calc.js` | Question editor, tab list, `save()`, trade math, risk calculator, `clean()`. |
| `js/05-prices.js` | Live prices from Finnhub (`getPx`). SMA150 code is switched off. |
| `js/06-views-events.js` | `view()` renders every tab; the main event handlers. |
| `js/07-calendar.js` | Custom date picker (`CAL`). |
| `js/08-account-cloud.js` | Device storage, backups, Firebase config, `cloudSave`, `onUser`, CSV download. |
| `js/09-theme-accessibility.js` | Theme and the Accessibility menu. |
| `js/10-import.js` | Import from CSV / Excel (.xlsx) files and broker reports. |
| `js/11-firebase-init.js` | Loads Firebase and connects sign-in. |
| `js/12-long-term.js` | Long-term portfolio panel and projection calculator. |
| `js/13-mobile-cards.js` | Phone cards for the journal and watchlist. |
| `js/14-coach.js` | AI coach chat (talks to `worker/`). |
| `js/15-landing-intro.js` | Landing page part 1: chart, phone menu, swipe rows. |
| `js/16-close-trade.js` | Close-trade window. |
| `js/17-landing-plans.js` | Landing page part 2: plans, prices (`PLANP`), scroll animation. |
| `js/18-profiles-dashboard-rules.js` | Profiles, dashboard blocks, personal rules ("price of indiscipline"). |
| `js/19-start.js` | Start-up. Must stay last. |
| `he.js` | Hebrew dictionary (`HE_EXT`). Loaded before the js/ files. |
| `privacy.html`, `terms.html`, `accessibility.html` | Legal pages (no scripts). |
| `firestore.rules` | Firestore security rules. **Not applied automatically**: paste them in the Firebase console and press Publish. |
| `worker/` | The AI coach server (Cloudflare Worker). Deployed by hand in Cloudflare; no keys in the code. |
| `tools/` | `check-load-order.js` and `format-html.py` (see below). |

## How the JS files work together

- They are **plain scripts** (not modules). All of them share **one global scope**,
  so a function in one file can call a function in another file.
- They run **in the order `index.html` lists them**. The order matters:
  code that runs while the page loads (not inside a function or an event handler)
  may only use things from the same file or from files listed **before** it.
  Start-up code belongs in `js/19-start.js`, which stays last.
- `view()` (in `06-views-events.js`) is still one large function that draws every tab.
  Splitting it per tab is possible later, but it changes code, so do it as a separate,
  tested task.

## Rules for every change

1. **Work on a draft branch**, show a screenshot, and push to `main` only after Guy writes "תעלה".
   Before a big change, push a restore branch named `before-<what>`.
2. **Put new code in the file of its feature.** A new feature that does not fit gets its own
   file; add it to `index.html` in the right place (before `19-start.js`).
3. **Readable code is the default.** Indentation, line breaks, a header comment at the top of
   every file and a one-line comment above every function.
   - JS and CSS: format with Prettier and the repo's `.prettierrc.json`:
     `prettier --write "js/*.js" "css/*.css" he.js`
   - HTML: `python3 tools/format-html.py index.html index.html` (same for the legal pages).
     **Do not wrap text lines in `index.html`**: the Hebrew translation looks texts up
     exactly as written, and a line break inside a sentence stops it from being translated.
4. **Check the load order** before pushing: `node tools/check-load-order.js` (must say OK).
5. **Raise `?v=` in `index.html`** when you change any `css/` or `js/` file
   (for example `?v=20261106` → `?v=20261107`), so browsers load the new files and not an
   old copy from their cache.
6. **Security:**
   - Put user text into HTML only through `esc()`. Tickers typed by hand go through `tk()`.
   - Data loaded from anywhere goes through `clean()` (journal) or `ltClean()` (long-term).
   - No inline scripts (`<script>…</script>` or `onclick="…"`): the CSP only allows script
     files from this site and Google's Firebase hosts. A new outside service must be added
     to the CSP `<meta>` in `index.html` on purpose.
   - Never put secret keys in this repo. The Firebase `apiKey` is public by design.
7. **Test before showing:** serve the folder (`npx http-server . -c-1`) and check it with
   Playwright on desktop and phone width, Hebrew and English, light and dark.
8. After an upload, remind the user to clear the browser cache (Safari: Cmd+Option+E,
   then Cmd+Shift+R).
