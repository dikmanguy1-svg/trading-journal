"""
Weekly stock scanner data build (runs in GitHub Actions, see .github/workflows/scanner.yml).

Universe: our own list of the ~500 largest US common stocks by market cap (built from Finnhub's
US symbol list + company profiles). No index constituent list is used.
Prices:   Massive (formerly Polygon) daily bars, 1 year per stock (free plan: 5 calls/minute).
Facts:    Finnhub basic financials and the earnings calendar (free plan: 60 calls/minute).
Output:   one JSON file written to Cloudflare KV (key "scan:latest"), served by the Wick server at /scan.

Secrets (GitHub): MASSIVE_API_KEY, FINNHUB_API_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
Nothing here ranks or recommends stocks: it only computes numbers that users filter themselves.
"""
import datetime as dt
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UNIVERSE_SIZE = 500
KV_NAMESPACE = "578d0ebc417640eea6a1f32132d45797"
EXCHANGES = {"XNYS", "XNAS"}
TODAY = dt.date.today()


class Limiter:
    """Simple per-minute rate limiter."""

    def __init__(self, per_min):
        self.gap = 60.0 / per_min
        self.last = 0.0

    def wait(self):
        d = time.time() - self.last
        if d < self.gap:
            time.sleep(self.gap - d)
        self.last = time.time()


FH = Limiter(55)
MS = Limiter(5)


def get_json(url, headers=None, limiter=None, tries=4):
    for i in range(tries):
        if limiter:
            limiter.wait()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "tradeink-scanner", **(headers or {})})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1:
                time.sleep(65)
                continue
            if e.code in (401, 403):
                print("  access denied:", url.split("?")[0], e.code)
                return None
            if i == tries - 1:
                print("  failed:", url.split("?")[0], e.code)
                return None
        except Exception as e:  # network hiccup
            if i == tries - 1:
                print("  failed:", url.split("?")[0], str(e)[:80])
                return None
            time.sleep(5)
    return None


def fh(path, key):
    return get_json("https://finnhub.io/api/v1/" + path, {"X-Finnhub-Token": key}, FH)


# ---------- universe ----------
def build_universe(fkey):
    syms = fh("stock/symbol?exchange=US", fkey) or []
    cands = [
        s["symbol"]
        for s in syms
        if s.get("type") == "Common Stock" and s.get("mic") in EXCHANGES and s.get("symbol", "").isalpha()
    ]
    print(f"universe candidates: {len(cands)}")
    prof = {}
    for i, sym in enumerate(cands):
        p = fh("stock/profile2?symbol=" + sym, fkey)
        if p and p.get("marketCapitalization") and (p.get("country") in (None, "", "US")):
            prof[sym] = {"name": p.get("name"), "industry": p.get("finnhubIndustry"), "cap": p["marketCapitalization"]}
        if i % 500 == 0:
            print(f"  profiles {i}/{len(cands)}")
    top = sorted(prof.items(), key=lambda kv: -kv[1]["cap"])[:UNIVERSE_SIZE]
    return {k: v for k, v in top}


# ---------- indicators ----------
def sma(xs, n):
    return sum(xs[-n:]) / n if len(xs) >= n else None


def rsi(closes, n=14):
    if len(closes) <= n:
        return None
    gains = losses = 0.0
    for i in range(1, n + 1):
        d = closes[i] - closes[i - 1]
        gains += max(d, 0)
        losses += max(-d, 0)
    ag, al = gains / n, losses / n
    for i in range(n + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        ag = (ag * (n - 1) + max(d, 0)) / n
        al = (al * (n - 1) + max(-d, 0)) / n
    if al == 0:
        return 50.0 if ag == 0 else 100.0
    return 100 - 100 / (1 + ag / al)


def atr(bars, n=14):
    if len(bars) <= n:
        return None
    trs = [
        max(b["h"] - b["l"], abs(b["h"] - p["c"]), abs(b["l"] - p["c"]))
        for p, b in zip(bars[:-1], bars[1:])
    ]
    a = sum(trs[:n]) / n
    for t in trs[n:]:
        a = (a * (n - 1) + t) / n
    return a


def ret(closes, days):
    if len(closes) <= days:
        return None
    return (closes[-1] / closes[-1 - days] - 1) * 100


def r2(x, d=2):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(x, d)


def compute(bars, spy):
    c = [b["c"] for b in bars]
    v = [b["v"] for b in bars]
    if len(c) < 60:
        return None
    last = c[-1]
    hi = max(b["h"] for b in bars[-252:])
    lo = min(b["l"] for b in bars[-252:])
    prior_hi = max(b["h"] for b in bars[-252:-5]) if len(bars) > 10 else None
    out = {
        "price": r2(last),
        "chg1w": r2(ret(c, 5)),
        "chg1m": r2(ret(c, 21)),
        "high52": r2(hi),
        "low52": r2(lo),
        "fromHigh52": r2((last / hi - 1) * 100),
        "fromLow52": r2((last / lo - 1) * 100),
        "newHigh52w": bool(prior_hi and max(b["h"] for b in bars[-5:]) > prior_hi),
        "avgVol20": int(sma(v, 20) or 0),
        "avgVol50": int(sma(v, 50) or 0),
        "volVsAvg50": r2(v[-1] / sma(v, 50)) if sma(v, 50) else None,
        "rsi14": r2(rsi(c), 1),
    }
    a = atr(bars)
    out["atr14"] = r2(a)
    out["atrPct"] = r2(a / last * 100) if a else None
    for n in (20, 50, 150, 200):
        m = sma(c, n)
        out[f"ma{n}"] = r2(m)
        out[f"vsMa{n}"] = r2((last / m - 1) * 100) if m else None
    for name, days in (("rs3m", 63), ("rs6m", 126), ("rs12m", 250)):
        a_, b_ = ret(c, days), ret(spy, days) if spy else None
        out[name] = r2(a_ - b_) if a_ is not None and b_ is not None else None
    return out


def bars_massive(sym, mkey):
    frm = (TODAY - dt.timedelta(days=380)).isoformat()
    url = (
        f"https://api.massive.com/v2/aggs/ticker/{urllib.parse.quote(sym)}/range/1/day/{frm}/{TODAY.isoformat()}"
        f"?adjusted=true&sort=asc&limit=500&apiKey={mkey}"
    )
    d = get_json(url, limiter=MS)
    res = (d or {}).get("results") or []
    return [{"c": r["c"], "h": r["h"], "l": r["l"], "v": r.get("v", 0)} for r in res if "c" in r]


def main():
    mkey, fkey = os.environ.get("MASSIVE_API_KEY"), os.environ.get("FINNHUB_API_KEY")
    cf_tok, cf_acc = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not all([mkey, fkey, cf_tok, cf_acc]):
        sys.exit("missing secrets")

    uni = build_universe(fkey)
    print(f"universe: {len(uni)} stocks")
    if len(uni) < 100:
        sys.exit("universe too small, keeping last week's data")

    spy = [b["c"] for b in bars_massive("SPY", mkey)]
    frm, to = TODAY.isoformat(), (TODAY + dt.timedelta(days=100)).isoformat()
    cal = (fh(f"calendar/earnings?from={frm}&to={to}", fkey) or {}).get("earningsCalendar") or []
    next_earn = {}
    for e in sorted(cal, key=lambda e: e.get("date", "")):
        next_earn.setdefault(e.get("symbol"), e.get("date"))

    rows = []
    for i, (sym, info) in enumerate(uni.items()):
        bars = bars_massive(sym, mkey)
        tech = compute(bars, spy)
        if not tech:
            continue
        met = (fh("stock/metric?metric=all&symbol=" + sym, fkey) or {}).get("metric") or {}
        rows.append(
            {
                "s": sym,
                "name": info["name"],
                "industry": info["industry"],
                "capM": r2(info["cap"], 0),
                **tech,
                "pe": r2(met.get("peTTM") if met.get("peTTM") is not None else met.get("peBasicExclExtraTTM")),
                "epsGrowth": r2(met.get("epsGrowthTTMYoy")),
                "revGrowth": r2(met.get("revenueGrowthTTMYoy")),
                "debtToEquity": r2(met.get("totalDebt/totalEquityQuarterly")),
                "nextEarnings": next_earn.get(sym),
            }
        )
        if i % 50 == 0:
            print(f"  computed {i}/{len(uni)}")

    rows.sort(key=lambda r: (r.get("name") or r["s"]).lower())
    data = {
        "asOf": dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "sources": {"prices": "Massive", "fundamentals": "Finnhub"},
        "universe": "About 500 of the largest US companies by market cap (our own list)",
        "count": len(rows),
        "rows": rows,
    }
    body = json.dumps(data, separators=(",", ":")).encode("utf-8")
    print(f"writing {len(rows)} rows, {len(body) // 1024} KB")
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{cf_acc}/storage/kv/namespaces/{KV_NAMESPACE}/values/scan:latest",
        data=body,
        method="PUT",
        headers={"Authorization": "Bearer " + cf_tok, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        print("KV write:", r.status)


if __name__ == "__main__":
    main()
