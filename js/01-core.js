/*
 * 01-core.js — part of the Trading.Journal app script.
 *
 * Core helpers and default data. Loaded first.
 * - Frame guard: hides the page if another site shows it inside a frame (anti-clickjacking).
 * - Small helpers used everywhere: $ (get element by id), esc (make text safe for HTML),
 *   tk (clean a typed ticker), $f (format money).
 * - Default question lists (Daily pulse, Stock screening, long-term versions).
 * - S: the whole app state (settings, trades, watchlist, answers...). Saved by save().
 * - Strategy data: trading styles, tools and the questions each tool adds.
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Anti-clickjacking: if the site is shown inside another site's frame, hide it and stop.
if (window.top !== window.self) {
  document.documentElement.style.display = "none";
  throw new Error("framed");
}
// Shortcut: get an element by its id.
const $ = id => document.getElementById(id);
// Make any text safe to put inside HTML (always use this for user text).
const esc = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
// Clean a ticker typed by hand: letters, digits and . - ^ : only, max 10.
const tk = v =>
  String(v || "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}.\-^:]/gu, "")
    .slice(0, 10);
// Format a number as money: $1,234.50 ("–" when empty).
const $f = (n, d = 0) =>
  n == null || isNaN(n)
    ? "–"
    : (n < 0 ? "-$" : "$") +
      Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
// Default Daily pulse questions (swing / day traders).
const PQ = [
  "Am I mentally clear, not acting out of anger, fear, financial pressure or greed (FOMO)?",
  "Is the relevant index (S&P 500 / Nasdaq) above its 50-day moving average?",
  "Is there no critical macro event today (rate decision, CPI, NFP) before a trade is locked in?",
  "Is volatility (VIX) in a normal range, not in an extreme spike (above ~30)?",
  "Have I finished reviewing open trades and trades closed yesterday?",
  "Have I set a daily/weekly loss limit, and do I know exactly what it is?"
];
// Default Stock screening questions.
const SQ = [
  "Weekly uptrend: higher highs and higher lows?",
  "Price above the 50-day moving average and also above the 150/200-day?",
  "Average daily volume (3 months) above 1,000,000 shares?",
  "Relative strength: the stock outperformed the market in recent months?",
  "The sector/industry is in a leadership trend?",
  "No earnings report expected within the next 5 trading days?",
  "A clear technical entry pattern exists (base, flag, cup-and-handle, breakout on volume)?",
  "A logical stop-loss level can be set in advance?",
  "Initial risk/reward looks like 1:3 or better?"
];
// The app state: everything the user has entered. Saved by save().
let S = {
  set: { pf: 10000, al: 0.1, mr: 0.01, rr: 2 },
  pulse: Array(6).fill(null),
  scr: { t: "", a: Array(9).fill(null) },
  calc: { t: "", dir: "Long", e: "", s: "", tg: "" },
  trades: [],
  wl: [],
  st: { type: "", style: "", tools: [], custom: [] },
  g: [],
  bd: null,
  rules: [],
  prof: []
};
// Trader types shown on the Strategy tab.
const STP = { day: "Day trader", swing: "Swing trader" };
// Daily pulse questions for long-term investors.
const LPQ = [
  "Am I investing money I won't need in the next 5 years?",
  "Is my emergency fund (3 to 6 months of expenses) in place?",
  "Am I buying because of my plan, not because of news or fear of missing out?",
  "Does this keep my portfolio within the split I planned?",
  "Have I looked at my holdings this month without reacting to short-term drops?",
  "Do I know the yearly fee (expense ratio) of what I'm buying?"
];
// Stock screening questions for long-term investors.
const LSQ = [
  "Do I understand how this company or fund makes money?",
  "Has revenue grown steadily over the last 5 years?",
  "Is the company profitable, or does it have a clear path to profit?",
  "Is its debt manageable compared to its cash flow?",
  "Is the price (P/E) reasonable compared to similar companies and its own history?",
  "Does it have a lasting edge over competitors (brand, size, network)?",
  "For a fund: is the yearly fee low (under about 0.2%)?",
  "Does it fit my plan and keep me diversified?",
  "Would I be comfortable holding it through a 30% drop?"
];
// True when the only chosen profile is long-term investor.
const ltOnly = () => !!(S.prof && S.prof.length && S.prof.every(p => p === "lt"));
// Trading styles.
const STY = {
  trend: "Trend following",
  brk: "Breakout / momentum",
  pull: "Pullback (buy the dip)",
  earn: "Earnings and news"
};
// The screening question each style adds (swing).
const STQ = {
  trend: "Weekly uptrend: higher highs and higher lows?",
  brk: "Is the stock breaking out of a clear base on above-average volume?",
  pull: "Is the stock pulling back to support within an established uptrend?",
  earn: "Is the next earnings date known, and does my trade plan fit around it?"
};
// Tools (swing): name and the screening question each tool adds.
const TL = {
  ma: [
    "Moving averages",
    "Price above the 50-day moving average and also above the 150/200-day?",
    "Is the relevant index (S&P 500 / Nasdaq) above its 50-day moving average?"
  ],
  vol: ["Volume", "Average daily volume (3 months) above 1,000,000 shares?"],
  rs: [
    "Relative strength",
    "Relative strength: the stock outperformed the market in recent months?"
  ],
  sec: ["Sector strength", "The sector/industry is in a leadership trend?"],
  earn: ["Earnings calendar", "No earnings report expected within the next 5 trading days?"],
  pat: [
    "Chart patterns",
    "A clear technical entry pattern exists (base, flag, cup-and-handle, breakout on volume)?"
  ],
  sr: [
    "Support and resistance",
    "Is there a clear support level near my entry to anchor the stop?"
  ],
  rsi: ["RSI", "Is RSI below ~70 (not overbought) at my entry?"],
  rr: ["Risk/reward", "Initial risk/reward looks like 1:3 or better?"],
  vix: [
    "VIX / volatility",
    null,
    "Is volatility (VIX) in a normal range, not in an extreme spike (above ~30)?"
  ],
  mac: [
    "Macro calendar",
    null,
    "Is there no critical macro event today (rate decision, CPI, NFP) before a trade is locked in?"
  ]
};
// Extra tools that exist only for day traders or only for swing traders.
const TLX = {
  day: {
    vwap: [
      "VWAP",
      "Is the price on the right side of VWAP for my direction (above for longs, below for shorts)?"
    ],
    orb: [
      "Opening range",
      "Has the opening range (first 5 or 15 minutes) been defined, and am I trading its breakout or breakdown?"
    ],
    gap: [
      "Pre-market gappers",
      "Is the stock gapping on a real catalyst with strong pre-market volume?"
    ],
    rvol: ["Relative volume", "Is relative volume (RVOL) at least 2 at my entry?"],
    l2: [
      "Level 2 / tape",
      "Do Level 2 and the time and sales confirm real buyers (or sellers) at my entry?"
    ],
    flt: [
      "Float and short interest",
      "Have I checked the float and the short interest, and do they fit my setup?"
    ],
    news: [
      "News and catalysts",
      "Is there a fresh, verified catalyst (not a rumor or social media hype)?"
    ],
    atr: [
      "ATR / daily range",
      "Does the stock's average daily range give enough room for my target, with the stop sized to it?"
    ],
    win: [
      "Trading window",
      "Am I trading inside my planned time window (for example the first 90 minutes or the last hour)?"
    ],
    intl: ["Market internals", null, "Do the market internals (TICK, ADD) support my direction?"]
  },
  swing: {
    wk: ["Weekly chart", "Is the weekly chart trend aligned with my trade direction?"],
    tl: ["Trend lines", "Is price respecting, or breaking, a clear trend line?"],
    fib: [
      "Fibonacci levels",
      "Is my entry near a meaningful Fibonacci retracement or extension level?"
    ],
    macd: ["MACD", "Is MACD confirming the move (bullish cross or a rising histogram)?"],
    inst: ["Institutional ownership", "Is institutional ownership strong and rising?"],
    fund: ["Earnings growth", "Are earnings and revenue growing at a healthy rate?"]
  }
};
// All tools for a trader type.
const toolsFor = t => ({ ...TL, ...(TLX[t] || {}) });
// Day-trader versions of the tool questions.
const TLD = {
  ma: [
    "Is the price above VWAP and the 9/20 EMA on the 5-minute chart?",
    "Are the S&P 500 / Nasdaq futures pointing in my trade direction before the open?"
  ],
  vol: [
    "Is today's volume well above normal (relative volume above 1.5) with strong pre-market activity?"
  ],
  rs: ["Is the stock stronger than the market today (relative strength on the day)?"],
  sec: ["Is the stock's sector one of the leading sectors today?"],
  earn: ["No earnings report or major scheduled news for this stock during today's session?"],
  pat: ["A clear intraday setup exists (opening range breakout, bull flag, VWAP reclaim)?"],
  sr: [
    "Is there a clear intraday level (pre-market high/low, previous day high or low) near my entry to anchor the stop?"
  ],
  rsi: ["Is RSI on the 5-minute chart not at an extreme at my entry?"],
  rr: ["Initial risk/reward looks like 1:2 or better?"]
};
// Day-trader versions of the style questions.
const STQD = {
  trend: "Is the stock trending intraday (higher highs and higher lows on the 5-minute chart)?",
  brk: "Is the stock breaking the opening range or a key level on above-average volume?",
  pull: "Is the stock pulling back to VWAP or the 9/20 EMA within an intraday uptrend?",
  earn: "Is today's catalyst (earnings or news) clear, and does my plan fit the move?"
};
// Level titles (Rookie, Apprentice, ...).
const TT = ["Rookie", "Apprentice", "Trader", "Sharp eye", "Pro", "Veteran", "Master"];
