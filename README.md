# Gold Scalper Bot — Node.js
## XAU/USD · EMA 9/21 · ATR · RSI · Bollinger Bands · ×20 Multiplier

This is the server version of your Gold Scalper. No browser needed.
Runs 24/7 on free cloud platforms.

---

## Files
- `bot.js` — the main trading bot
- `package.json` — dependencies
- `.env.example` — sample environment variables
- `.gitignore` — deploy-safe git ignore rules
- `README.md` — this file

---

## Free Deployment Options

### Option A — Railway (Easiest, Recommended)
Free tier: 500 hours/month (enough for the trading session window)

1. Go to https://railway.app and sign up (free)
2. Click **New Project → Deploy from GitHub repo**
   - OR click **New Project → Empty Project → Add Service → GitHub Repo**
3. Push these 3 files to a GitHub repo (github.com → New repo → upload files)
4. Connect Railway to that GitHub repo
5. Go to **Variables** tab in Railway and add:
   ```
   DERIV_PAT    = your_deriv_pat_token_here
   MODE         = demo
   STAKE        = 1
   TRADE_TP     = 0.20
   TRADE_SL     = 0.40
   SESSION_TP   = 5
   SESSION_SL   = 3
   SHEET_URL    = your_google_sheets_url (optional)
   ```
6. Click **Deploy** — it will run automatically!
7. Check the **Logs** tab to see the bot output

To switch to REAL money: change `MODE` to `real` in Variables tab.

---

### Option B — Render (Also Free)
Free tier: 750 hours/month

1. Go to https://render.com and sign up (free)
2. Click **New → Background Worker** (NOT Web Service)
3. Connect your GitHub repo
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `node bot.js`
5. Add environment variables (same as Railway above)
6. Click **Create Background Worker**

---

### Option C — GitHub + Railway Auto-Deploy
Every time you push changes to GitHub, Railway re-deploys automatically.

---

## Environment Variables

| Variable     | Required | Default | Description |
|-------------|----------|---------|-------------|
| DERIV_PAT   | YES      | —       | Your Deriv API token (PAT) with Trade scope |
| MODE        | no       | demo    | Preferred account mode variable: `demo` or `real` |
| ACCT_MODE   | no       | demo    | Backward-compatible alias for `MODE` |
| STAKE       | no       | 1       | Stake per trade in USD (min $0.35) |
| TRADE_TP    | no       | 0.20    | Per-trade take profit in USD |
| TRADE_SL    | no       | 0.40    | Per-trade stop loss in USD |
| SESSION_TP  | no       | 5       | Stop trading after +$X profit |
| SESSION_SL  | no       | 3       | Stop trading after -$X loss |
| SHEET_URL   | no       | —       | Google Sheets Web App URL for trade logging |

---

## How to Get Your Deriv PAT Token
1. Go to https://developers.deriv.com
2. Login → Dashboard → API Tokens
3. Create token with **Trade** scope
4. Copy the token → paste as DERIV_PAT

---

## Strategy (unchanged from browser version)
- Asset: XAU/USD Gold (`frxXAUUSD`)
- Multiplier: ×20
- Contract TP: env `TRADE_TP` | Contract SL: env `TRADE_SL`
- Session: Mon–Fri 07:00–17:00 GMT
- All 5 layers must confirm:
  1. EMA 9/21 fresh cross
  2. ATR expanding (current > 14-period average)
  3. RSI in 38–62 zone
  4. Bollinger Band expanding
  5. Within trading session
- Circuit breaker: 3 consecutive losses → 10 min pause

---

## Logs
The bot prints every action with timestamps to stdout.
You can read live logs in Railway/Render dashboard.

Sample output:
```
[09:15:32] ✅ Connected [DEMO] — loading Gold candles...
[09:15:33] ✅ 150 Gold candles loaded
[09:15:36] ℹ️  Layers → EMA:✗(↑) ATR:✓ RSI:✓(52.3) BB:✓ Session:✓
[09:18:42] 📡 All 5 layers confirmed! BULL ↑ — opening trade
[09:18:43] 🚀 Trade opened! ID:248753981 | ↑ MULTUP ×20
[09:19:01] 🏆 WIN +$0.2000 | Session P&L: +$0.2000 | W:1 L:0
```
