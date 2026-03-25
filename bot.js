// ═══════════════════════════════════════════════════════════════
// GOLD SCALPER — Node.js Version
// XAU/USD · EMA 9/21 · ATR · RSI · Bollinger Bands · ×20
// Deploy FREE on Railway or Render — runs 24/7 without browser
// ═══════════════════════════════════════════════════════════════

const WebSocket = require('ws');
const fetch = require('node-fetch');

// ── CONFIG (edit these) ──────────────────────────────────────────
const PAT = process.env.DERIV_PAT || process.env.DERIV_TOKEN || process.env.PAT || ''; // Preferred: DERIV_PAT
const rawMode = (process.env.MODE || process.env.ACCT_MODE || 'demo').toLowerCase();
const ACCT_MODE = rawMode === 'real' ? 'real' : 'demo';      // Supports MODE or ACCT_MODE
const STAKE = parseFloat(process.env.STAKE || '1');
const TRADE_TP = parseFloat(process.env.TRADE_TP || '0.20'); // Per-trade take profit
const TRADE_SL = parseFloat(process.env.TRADE_SL || '0.40'); // Per-trade stop loss
const SESSION_TP = parseFloat(process.env.SESSION_TP || '5'); // Stop trading after +$5
const SESSION_SL = parseFloat(process.env.SESSION_SL || '3'); // Stop trading after -$3
const SHEET_URL = process.env.SHEET_URL || '';          // Google Sheets web app URL

// ── LOCKED STRATEGY ──────────────────────────────────────────────
const APP_ID = '32N4CkcFneTdkBmgj7TWl';
const ACCOUNTS_URL = 'https://api.derivws.com/trading/v1/options/accounts';
const SYM = 'frxXAUUSD';
const MULT = 20;
const EMA_FAST = 9, EMA_SLOW = 21;
const ATR_PERIOD = 14, ATR_MA = 14;
const RSI_PERIOD = 14;
const BB_PERIOD = 20, BB_MULT = 2;
const MAX_LOSS = 3, PAUSE_MS = 10 * 60 * 1000;
const CANDLE_GR = 60, CANDLE_CNT = 150;
const SESS_START = 7, SESS_END = 17;

// ── STATE ────────────────────────────────────────────────────────
let ws = null;
let running = false;
let contractId = null;
let pingInt = null, scanInt = null, pauseInt = null;
let totalPnl = 0, wins = 0, losses = 0, balance = 0;
let consLoss = 0;
let candles = [];
let inTrade = false, lastDir = 'CALL', soldFired = false;
let paused = false, rid = 0, pendingProposalDir = null;
let acctDemo = '', acctReal = '';

// ── HELPERS ──────────────────────────────────────────────────────
const nid = () => ++rid;
const ts = () => new Date().toTimeString().slice(0, 8);
const log = (msg, type = '') => {
  const icons = { ok: '✅', err: '❌', warn: '⚠️ ', sig: '📡', win: '🏆', sl_: '🛑', info: 'ℹ️ ', sheet: '📋', trade: '🚀' };
  const icon = icons[type] || '   ';
  console.log(`[${ts()}] ${icon} ${msg}`);
};

function send(d) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(d));
  } else {
    log('WS not open', 'err');
  }
}

// ── SESSION CHECK ────────────────────────────────────────────────
function isSessionOpen() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const h = now.getUTCHours();
  return h >= SESS_START && h < SESS_END;
}

// ── INDICATORS ───────────────────────────────────────────────────
function calcEMA(arr, n) {
  if (arr.length < n) return null;
  const k = 2 / (n + 1);
  let e = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}

function calcATR(cs, n) {
  if (cs.length < n + 1) return null;
  const s = cs.slice(-n - 1);
  let sum = 0;
  for (let i = 1; i < s.length; i++) {
    const tr = Math.max(s[i].h - s[i].l, Math.abs(s[i].h - s[i - 1].c), Math.abs(s[i].l - s[i - 1].c));
    sum += tr;
  }
  return sum / n;
}

function calcATRHistory(cs, n, p) {
  if (cs.length < n + p) return null;
  const atrs = [];
  for (let i = 0; i < p; i++) {
    const a = calcATR(cs.slice(0, cs.length - i), n);
    if (a !== null) atrs.push(a);
  }
  if (!atrs.length) return null;
  return atrs.reduce((a, b) => a + b, 0) / atrs.length;
}

function calcRSI(closes, n) {
  if (closes.length < n + 1) return null;
  const s = closes.slice(-n - 1);
  let gains = 0, losses_ = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s[i] - s[i - 1];
    if (d > 0) gains += d;
    else losses_ += Math.abs(d);
  }
  const ag = gains / n, al = losses_ / n;
  if (al === 0) return 100;
  return 100 - (100 / (1 + ag / al));
}

function calcBB(closes, n, mult) {
  if (closes.length < n) return null;
  const s = closes.slice(-n);
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const stddev = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const width = (stddev * mult * 2) / mean;
  return { upper: mean + stddev * mult, lower: mean - stddev * mult, width, mean };
}

function calcBBHistory(closes, n, mult, p) {
  if (closes.length < n + p) return null;
  const widths = [];
  for (let i = 0; i < p; i++) {
    const s = closes.slice(0, closes.length - i);
    const bb = calcBB(s, n, mult);
    if (bb) widths.push(bb.width);
  }
  if (!widths.length) return null;
  return widths.reduce((a, b) => a + b, 0) / widths.length;
}

// ── SIGNAL ENGINE (5-layer) ──────────────────────────────────────
function getSignal() {
  const closes = candles.map(c => c.c);
  const n = candles.length;
  const needed = EMA_SLOW + ATR_MA + RSI_PERIOD + BB_PERIOD + 10;
  if (n < needed) return null;

  // 1. EMA cross
  const e9 = calcEMA(closes, EMA_FAST);
  const e21 = calcEMA(closes, EMA_SLOW);
  const prev = closes.slice(0, -1);
  const pe9 = calcEMA(prev, EMA_FAST);
  const pe21 = calcEMA(prev, EMA_SLOW);
  if (!e9 || !e21 || !pe9 || !pe21) return null;
  const freshCross = (pe9 > pe21) !== (e9 > e21);
  const isBull = e9 > e21;

  // 2. ATR expanding
  const atr = calcATR(candles, ATR_PERIOD);
  const atrSma = calcATRHistory(candles, ATR_PERIOD, ATR_MA);
  if (!atr || !atrSma) return null;
  const atrOk = atr > atrSma;

  // 3. RSI in zone 38-62
  const rsi = calcRSI(closes, RSI_PERIOD);
  if (rsi === null) return null;
  const rsiOk = rsi >= 38 && rsi <= 62;

  // 4. Bollinger expanding
  const bb = calcBB(closes, BB_PERIOD, BB_MULT);
  const bbAvgWidth = calcBBHistory(closes, BB_PERIOD, BB_MULT, BB_PERIOD);
  if (!bb || !bbAvgWidth) return null;
  const bbOk = bb.width > bbAvgWidth;

  // 5. Session
  const sessOk = isSessionOpen();

  // Log layer status
  log(`Layers → EMA:${freshCross ? '✓' : '✗'}(${isBull ? '↑' : '↓'}) ATR:${atrOk ? '✓' : '✗'} RSI:${rsiOk ? '✓' : '✗'}(${rsi.toFixed(1)}) BB:${bbOk ? '✓' : '✗'} Session:${sessOk ? '✓' : '✗'}`, 'info');

  if (!sessOk) return null;
  if (freshCross && atrOk && rsiOk && bbOk && sessOk) {
    return isBull ? 'CALL' : 'PUT';
  }
  return null;
}

// ── GOOGLE SHEETS LOGGER ─────────────────────────────────────────
async function logToSheets(trade) {
  if (!SHEET_URL) return;
  try {
    await fetch(SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade)
    });
    log('Trade logged to Google Sheets', 'sheet');
  } catch (ex) {
    log('Sheets log failed: ' + ex.message, 'warn');
  }
}

// ── CIRCUIT BREAKER ──────────────────────────────────────────────
function triggerCircuit() {
  paused = true;
  log('3 consecutive losses — 10 min circuit breaker!', 'warn');
  let rem = PAUSE_MS;
  pauseInt = setInterval(() => {
    rem -= 1000;
    if (rem <= 0) {
      clearInterval(pauseInt); pauseInt = null;
      paused = false; consLoss = 0;
      log('Circuit breaker ended — resuming scan', 'info');
      if (running && !inTrade && isSessionOpen()) startScan();
    } else {
      const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
      if (rem % 60000 < 1000) log(`Circuit breaker: ${m}:${s.toString().padStart(2, '0')} remaining`, 'warn');
    }
  }, 1000);
}

// ── SCANNING ────────────────────────────────────────────────────
function startScan() {
  if (!running || inTrade || paused) return;
  if (!isSessionOpen()) {
    log('Outside session (Mon-Fri 07:00-17:00 GMT) — waiting...', 'warn');
    return;
  }
  clearInterval(scanInt); scanInt = null;
  log('Scanning Gold XAU/USD...', 'ok');
  scanInt = setInterval(() => {
    if (!running || inTrade || paused) { clearInterval(scanInt); scanInt = null; return; }
    if (!isSessionOpen()) { clearInterval(scanInt); scanInt = null; log('Session closed', 'warn'); return; }
    if (candles.length < EMA_SLOW + ATR_MA + RSI_PERIOD + BB_PERIOD + 10) return;
    const sig = getSignal();
    if (sig) {
      log(`All 5 layers confirmed! ${sig === 'CALL' ? 'BULL ↑' : 'BEAR ↓'} — opening trade`, 'sig');
      clearInterval(scanInt); scanInt = null;
      openTrade(sig);
    }
  }, 3000);
}

// ── OPEN TRADE ───────────────────────────────────────────────────
function openTrade(dir) {
  if (!running || inTrade) return;
  inTrade = true; lastDir = dir; soldFired = false;
  log(`Opening ${dir === 'CALL' ? '↑ MULTUP' : '↓ MULTDOWN'} trade on Gold ×${MULT} | Stake: $${STAKE}`, 'trade');
  pendingProposalDir = dir;
  send({
    proposal: 1,
    amount: STAKE,
    basis: 'stake',
    contract_type: dir === 'CALL' ? 'MULTUP' : 'MULTDOWN',
    currency: 'USD',
    underlying_symbol: SYM,
    multiplier: MULT,
    limit_order: { stop_loss: TRADE_SL },
    req_id: nid()
  });
}

function startMonitor() {
  send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1, req_id: nid() });
}

// ── MESSAGE HANDLER ──────────────────────────────────────────────
function onMessage(raw) {
  let d;
  try { d = JSON.parse(raw); } catch { return; }
  if (!d || d.msg_type === 'ping') return;

  if (d.error) {
    if (['AlreadySold', 'ContractSoldError'].includes(d.error.code)) return;
    log(`[${d.error.code}] ${d.error.message}`, 'err');
    if (inTrade && !contractId) {
      inTrade = false; pendingProposalDir = null;
      if (running && !paused && isSessionOpen()) setTimeout(startScan, 3000);
    }
    return;
  }

  if (d.msg_type === 'balance' && d.balance) {
    balance = parseFloat(d.balance.balance) || balance;
    log(`Balance: $${balance.toFixed(2)}`, 'info');
  }

  if (d.msg_type === 'candles' && d.candles) {
    candles = d.candles.map(c => ({ o: +c.open, h: +c.high, l: +c.low, c: +c.close, e: +c.epoch }));
    log(`${candles.length} Gold candles loaded`, 'ok');
    if (running && !inTrade && isSessionOpen()) startScan();
  }

  if (d.msg_type === 'ohlc' && d.ohlc) {
    const o = d.ohlc;
    const ce = Math.floor((+o.open_time || +o.epoch) / CANDLE_GR) * CANDLE_GR;
    const last = candles[candles.length - 1];
    if (last && last.e === ce) {
      last.h = Math.max(last.h, +o.high);
      last.l = Math.min(last.l, +o.low);
      last.c = +o.close;
    } else if (!last || ce > last.e) {
      candles.push({ o: +o.open, h: +o.high, l: +o.low, c: +o.close, e: ce });
      if (candles.length > 500) candles.shift();
    }
  }

  if (d.msg_type === 'proposal' && d.proposal) {
    if (!inTrade || !pendingProposalDir) return;
    const proposalId = d.proposal.id;
    log(`Proposal OK — buying ${pendingProposalDir === 'CALL' ? 'MULTUP ↑' : 'MULTDOWN ↓'} at $${STAKE}`, 'info');
    send({ buy: proposalId, price: STAKE, req_id: nid() });
    pendingProposalDir = null;
  }

  if (d.msg_type === 'buy') {
    if (d.error) {
      log('Buy error: ' + d.error.message, 'err');
      inTrade = false;
      if (running && !paused && isSessionOpen()) setTimeout(startScan, 3000);
      return;
    }
    contractId = d.buy.contract_id;
    log(`Trade opened! ID:${contractId} | ${lastDir === 'CALL' ? '↑ MULTUP' : '↓ MULTDOWN'} ×${MULT}`, 'trade');
    startMonitor();
  }

  if (d.msg_type === 'proposal_open_contract' && d.proposal_open_contract) {
    const poc = d.proposal_open_contract;
    if (poc.contract_id !== contractId) return;
    const profit = parseFloat(poc.profit) || 0;

    // Auto sell at TP
    if (profit >= TRADE_TP && !soldFired && contractId) {
      soldFired = true;
      log(`+$${profit.toFixed(4)} — TP reached! Selling...`, 'sig');
      send({ sell: contractId, price: 0, req_id: nid() });
    }

    if (poc.is_sold || poc.status === 'sold') {
      const fp = parseFloat(poc.profit) || 0;
      totalPnl += fp;
      inTrade = false; soldFired = false; contractId = null;

      if (fp > 0) {
        wins++; consLoss = 0;
        log(`WIN +$${fp.toFixed(4)} | Session P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(4)} | W:${wins} L:${losses}`, 'win');
      } else {
        losses++; consLoss++;
        log(`LOSS -$${Math.abs(fp).toFixed(4)} | Consec losses: ${consLoss} | W:${wins} L:${losses}`, 'sl_');
      }

      // Log to Google Sheets
      logToSheets({
        time: new Date().toISOString(),
        asset: 'XAU/USD Gold',
        direction: lastDir,
        stake: STAKE,
        multiplier: MULT,
        profit: fp,
        result: fp > 0 ? 'WIN' : 'LOSS',
        total_pnl: totalPnl,
        wins,
        losses,
        session: ACCT_MODE.toUpperCase()
      });

      if (totalPnl >= SESSION_TP) { log(`Session profit target +$${SESSION_TP} hit! Stopping.`, 'ok'); stopBot(); return; }
      if (totalPnl <= -SESSION_SL) { log(`Session max loss -$${SESSION_SL} hit! Stopping.`, 'err'); stopBot(); return; }
      if (consLoss >= MAX_LOSS) { triggerCircuit(); return; }
      if (running && !paused && isSessionOpen()) setTimeout(startScan, 500);
    }
  }

  if (d.msg_type === 'sell' && d.sell) {
    log(`Sold for $${parseFloat(d.sell.sold_for).toFixed(4)}`, 'ok');
  }
}

// ── WEBSOCKET SETUP ──────────────────────────────────────────────
function setupSubs() {
  send({ balance: 1, subscribe: 1, req_id: nid() });
  send({ ticks_history: SYM, style: 'candles', granularity: CANDLE_GR, count: CANDLE_CNT, end: 'latest', subscribe: 1, req_id: nid() });
  pingInt = setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) send({ ping: 1, req_id: nid() }); }, 25000);
}

async function connect() {
  if (!PAT) { log('ERROR: DERIV_PAT environment variable not set!', 'err'); process.exit(1); }

  // Fetch account IDs
  log(`Detecting ${ACCT_MODE.toUpperCase()} account...`, 'info');
  const r = await fetch(ACCOUNTS_URL, { headers: { 'Authorization': 'Bearer ' + PAT, 'Deriv-App-ID': APP_ID } });
  if (!r.ok) throw new Error('Account fetch failed: HTTP ' + r.status);
  const data = await r.json();
  const list = data?.data || [];
  acctDemo = list.find(a => a.account_type === 'demo')?.account_id || '';
  acctReal = list.find(a => a.account_type === 'real')?.account_id || '';
  log(`Accounts found → Demo: ${acctDemo || 'none'} | Real: ${acctReal || 'none'}`, 'ok');

  const acctId = ACCT_MODE === 'demo' ? acctDemo : acctReal;
  if (!acctId) throw new Error(`No ${ACCT_MODE} account found`);

  // Get OTP / WebSocket URL
  log(`Getting OTP for ${ACCT_MODE.toUpperCase()} (${acctId})...`, 'info');
  const otpRes = await fetch(`${ACCOUNTS_URL}/${acctId}/otp`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + PAT, 'Deriv-App-ID': APP_ID }
  });
  if (!otpRes.ok) {
    let msg = 'HTTP ' + otpRes.status;
    try { const j = await otpRes.json(); msg = j?.errors?.[0]?.message || j?.error?.message || msg; } catch { }
    throw new Error('OTP failed: ' + msg);
  }
  const otpData = await otpRes.json();
  const wsUrl = otpData?.data?.url;
  if (!wsUrl) throw new Error('No WebSocket URL in OTP response');

  log(`Connecting to ${ACCT_MODE.toUpperCase()}...`, 'info');
  ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    log(`Connected [${ACCT_MODE.toUpperCase()}] — loading Gold candles...`, 'ok');
    setupSubs();
  });

  ws.on('message', data => onMessage(data.toString()));

  ws.on('error', err => log('WS error: ' + err.message, 'err'));

  ws.on('close', () => {
    if (running) {
      log('Disconnected — reconnecting in 5s...', 'err');
      setTimeout(async () => {
        if (!running) return;
        log('Reconnecting...', 'info');
        try { await connect(); }
        catch (ex) { log('Reconnect failed: ' + ex.message, 'err'); stopBot(); }
      }, 5000);
    }
  });
}

// ── BOT CONTROL ──────────────────────────────────────────────────
function stopBot() {
  running = false;
  [pingInt, scanInt, pauseInt].forEach(i => { try { if (i) clearInterval(i); } catch { } });
  pingInt = scanInt = pauseInt = null;
  if (ws) { try { ws.close(); } catch { } ws = null; }
  contractId = null; inTrade = false; soldFired = false; paused = false;
  log('Bot stopped.', 'warn');
  log(`Final: Wins=${wins} Losses=${losses} P&L=${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(4)}`, 'info');
}

async function startBot() {
  log('══════════════════════════════════════════', 'info');
  log(`Gold Scalper Node.js · XAU/USD · ×${MULT} Multiplier`, 'info');
  log(`Mode: ${ACCT_MODE.toUpperCase()} | Stake: $${STAKE} | Trade TP: +$${TRADE_TP} | Trade SL: -$${TRADE_SL}`, 'info');
  log(`Session TP: +$${SESSION_TP} | Session SL: -$${SESSION_SL}`, 'info');
  log('Strategy: EMA 9/21 + ATR + RSI(38-62) + BB Expansion + Session', 'info');
  log('Session: Mon-Fri 07:00-17:00 GMT | Peak: 13:00-17:00 GMT', 'info');
  log('══════════════════════════════════════════', 'info');

  totalPnl = 0; wins = 0; losses = 0; consLoss = 0;
  candles = []; inTrade = false; soldFired = false;
  contractId = null; paused = false; rid = 0; running = true;

  try {
    await connect();
  } catch (ex) {
    log('Startup failed: ' + ex.message, 'err');
    running = false;
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => { log('Shutting down...', 'warn'); stopBot(); process.exit(0); });
process.on('SIGTERM', () => { log('Shutting down...', 'warn'); stopBot(); process.exit(0); });

// Start
startBot();
