/*
 * 18h-day-limits.js — part of the TradeInk app script.
 *
 * Daily limits (14.11), mostly for day traders: a max loss per day and a max number of new
 * trades per day (Account and risk settings: S.set.dml in $, S.set.dmt trades; 0 = off).
 * When a limit is reached, adding a new trade today asks you to stop; it opens again tomorrow.
 * js/06 calls dayLim() before adding a trade and shows dayLimMsg() on the risk calculator.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Today's realized P&L and the number of trades opened today.
function dayStats() {
  const d = dkey(new Date());
  return {
    pl: S.trades.filter(t => t.x != null && t.xd === d).reduce((s, t) => s + pnl(t), 0),
    n: S.trades.filter(t => t.d === d).length
  };
}
// The reached limit as a sentence, or "" when trading is fine today.
function dayLim() {
  const L = S.set || {},
    s = dayStats();
  if (L.dml > 0 && s.pl <= -L.dml) return "You reached your max loss for today. Stop for today.";
  if (L.dmt > 0 && s.n >= L.dmt) return "You reached your max trades for today. Stop for today.";
  return "";
}
// A red note for the calculator when a limit is reached.
const dayLimMsg = () => {
  const m = dayLim();
  return m ? `<div class="status no">${m}</div>` : "";
};
