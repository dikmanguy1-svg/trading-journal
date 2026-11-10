/*
 * 18d-strategy-questions.js — part of the TradeInk app script.
 *
 * Personal screening questions (10.11). buildQ() in js/02 uses these when you press
 * "Build my questions" on the Strategy tab:
 * - stQ(): a tool's question written for your trading style (breakout + volume asks about
 *   breakout-day volume, pullback + volume asks about volume drying up, and so on).
 * - stNums(): the risk/reward and stop questions use your own numbers from the settings.
 * - stLT(): if you are also a long-term investor (and not a day trader), two long-term questions.
 * - FTL: fundamental tools (10.11), picked like the technical tools; you can mix both kinds.
 *   Thresholds come from common investor checklists (CAN SLIM, Peter Lynch, value investing).
 * Every question here has a Hebrew version in he.js (the numbered ones in HR, js/03).
 *
 * All js/*.js files share one global scope and run in the order index.html lists them.
 */

// Fundamental tools: name and the screening question each adds. For swing traders and investors.
// "fund" and "inst" were swing tools before; the keys stay so saved choices keep working.
const FTL = {
  pe: [
    "P/E and PEG",
    "Is the valuation reasonable: P/E in line with peers and its own history, and PEG (P/E divided by growth) around 1 or lower?"
  ],
  mos: [
    "Margin of safety",
    "Is the price at least 20% below the fair value I worked out in advance?"
  ],
  fcf: ["Free cash flow", "Is free cash flow positive and growing over the last 3 years?"],
  roe: ["Return on capital", "Is return on equity (or on invested capital) above 15%?"],
  debt: [
    "Debt",
    "Is debt under control (debt to equity below about 1, and interest easily covered by profit)?"
  ],
  mrg: ["Profit margins", "Are profit margins stable or rising, and good compared with peers?"],
  fund: [
    "EPS growth",
    "Did earnings per share grow at least 25% in the last quarter (vs. a year ago), and about 25% a year over the last 3 years?"
  ],
  rev: ["Revenue growth", "Is revenue growing steadily, year after year?"],
  ins: [
    "Insider buying",
    "Are company insiders buying shares with their own money (and not selling heavily)?"
  ],
  inst: [
    "Institutional ownership",
    "Is the number of institutions (funds) holding the stock rising?"
  ],
  moat: [
    "Competitive edge",
    "Does the company have a lasting edge over competitors (brand, network, switching costs)?"
  ],
  div: [
    "Dividend",
    "Is the dividend steady, with a payout that leaves a cushion (not most of the profit)?"
  ]
};
// Swing: [style][tool] = the tool's question for that style.
const CQ = {
  trend: {
    ma: "Is price above a rising 50-day moving average, with the 50-day above the 200-day?",
    vol: "Is volume higher on up days than on down days in recent weeks?",
    rs: "Is the stock's relative strength making new highs along with the trend?",
    sec: "Is the stock's sector in an uptrend too (above its own 50-day moving average)?",
    pat: "Is the trend clean, and the stock not stretched far above its 50-day moving average?",
    sr: "Is my entry close to the rising trend support (20 or 50-day moving average, or a recent low)?",
    rsi: "Is RSI holding above 40 to 50 in the trend, without being above 80?",
    wk: "Is the weekly chart in a clear uptrend too?",
    tl: "Is price holding above the rising trend line?",
    macd: "Is MACD above zero, confirming the trend?"
  },
  brk: {
    ma: "Is the base forming above a rising 50-day moving average?",
    vol: "Is volume on the breakout day at least 1.5 times the 50-day average?",
    rs: "Did relative strength reach a new high before or together with the breakout?",
    sec: "Are other stocks in the same sector breaking out too?",
    pat: "Is the base at least 3 weeks long and tight, not wide and loose?",
    sr: "Is the stock clearing a clear resistance level, with my stop just under the breakout point?",
    rsi: "Is RSI rising above 60 on the breakout, without being above 80?",
    earn: "Is this a real breakout and not an earnings gap I am chasing, with no earnings in the next 5 trading days?",
    tl: "Is price breaking above a clear down trend line or the top of the base?",
    macd: "Is MACD turning up together with the breakout?"
  },
  pull: {
    ma: "Has price pulled back to the rising 20 or 50-day moving average and held it?",
    vol: "Is volume drying up on the pullback (lighter than on the way up)?",
    rs: "Is the stock holding up better than the market during the pullback?",
    pat: "Is the pullback orderly (small candles, no heavy selling)?",
    sr: "Is the pullback holding a clear support level, with my stop just below it?",
    rsi: "Has RSI cooled to about 40 to 50 and started to turn up?",
    fib: "Is the pullback stopping near the 38% to 62% Fibonacci retracement?",
    tl: "Is price bouncing off the rising trend line?",
    macd: "Is MACD turning back up after the pullback?"
  },
  earn: {
    vol: "Is volume after the news at least 2 times normal?",
    rs: "Is the stock stronger than its sector after the news?",
    pat: "Is the stock holding its post-earnings gap, not filling it?",
    sr: "Is my stop below the low of the gap day?",
    fund: "Did earnings and revenue beat expectations and grow over last year?"
  }
};
// Day trading: [style][tool] = the tool's question for that style.
const CQD = {
  trend: {
    ma: "Is the 9 EMA above the 20 EMA on the 5-minute chart, both rising?",
    vwap: "Has price stayed above VWAP since the open?"
  },
  brk: {
    vol: "Is relative volume at least 2 on the breakout candle?",
    orb: "Is price breaking the opening range high (or low for shorts) on volume?",
    vwap: "Is the breakout happening above VWAP?",
    sr: "Is the stock clearing the pre-market high or the previous day's high?"
  },
  pull: {
    vwap: "Is the pullback holding VWAP?",
    ma: "Has the pullback reached the 9 or 20 EMA on the 5-minute chart and held it?",
    vol: "Is volume lighter on the pullback than on the push up?"
  },
  earn: {
    news: "Is the catalyst fresh today and verified?",
    gap: "Is the gap holding above the pre-market low?",
    rvol: "Is relative volume at least 3?"
  }
};
// The question for one tool, written for the chosen style (null = use the tool's own question).
function stQ(style, tool, day) {
  const M = day ? CQD : CQ;
  return (M[style] && M[style][tool]) || null;
}
// A number for a question: 1.5 stays 1.5, 2.0 becomes 2.
const stN = v => String(+(+v).toFixed(2));
// The risk/reward and stop questions with your own numbers from the settings.
function stNums() {
  const rr = S.set && S.set.rr > 0 ? stN(S.set.rr) : "2",
    mr = S.set && S.set.mr > 0 ? stN(S.set.mr * 100) : "1";
  // A long-term investor (only) gets a position-size question instead of the stop-loss question.
  if (ltOnly())
    return {
      rr: "Is my target at least " + rr + " times my risk (my minimum risk/reward)?",
      stop: "Does this position keep my portfolio diversified (no single stock too big a part of it)?"
    };
  return {
    rr: "Is my target at least " + rr + " times my risk (my minimum risk/reward)?",
    stop:
      "Can I set a logical stop-loss in advance, so that if it is hit I lose no more than " +
      mr +
      "% of my account?"
  };
}
// Long-term questions for a swing trader who is also a long-term investor (not for day traders).
function stLT(day) {
  const P = S.prof || [];
  if (day || !P.includes("lt") || !P.includes("swing")) return [];
  const q = [
    "Is it clear to me before buying whether this is a swing trade or a long-term holding (and I will not turn a losing swing trade into a long-term one)?"
  ];
  // The business-health question is left out when fundamental tools already ask about it.
  if (!S.st.tools.some(k => FTL[k]))
    q.push(
      "Is the business itself healthy (profitable or with a clear path to profit, and debt under control)?"
    );
  return q;
}
