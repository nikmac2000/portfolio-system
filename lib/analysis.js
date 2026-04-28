// lib/analysis.js — Teknisk analyse + nyheder

export const HOLDINGS = [
  { name: 'NKT', ticker: 'NKT.CO', qty: 4, costTotal: 3139 },
  { name: 'Kongsberg Gruppen', ticker: 'KOG.OL', qty: 10, costTotal: 877.82 },
  { name: 'Kongsberg Maritime', ticker: 'KMAR.OL', qty: 10, costTotal: 0 },
  { name: 'SAAB B', ticker: 'SAAB-B.ST', qty: 3, costTotal: 483 },
  { name: 'Novo Nordisk B', ticker: 'NOVO-B.CO', qty: 1, costTotal: 660.9 },
  { name: 'Tesla', ticker: 'TSLA', qty: 1, costTotal: 1765.49 },
  { name: 'Oklo A', ticker: 'OKLO', qty: 2, costTotal: 361.96 },
  { name: 'Coinbase', ticker: 'COIN', qty: 1, costTotal: 1322.71 },
  { name: 'Take-Two', ticker: 'TTWO', qty: 1, costTotal: 1401.23 },
  { name: 'Thales', ticker: 'HO.PA', qty: 2, costTotal: 0 },
  { name: 'thyssenkrupp', ticker: 'TKA.DE', qty: 12, costTotal: 0 },
  { name: 'Nordnet One Offensiv', ticker: null, qty: 92.74, costTotal: 12999.96 },
];

export const GOLD = [
  { name: '3 × 2,5 g guldbar', grams: 7.5 },
  { name: '1/20 oz guldmønt', grams: 31.1035 / 20 },
];

export const SHIFTS = [
  { date: '2026-04-19', start: '16:00', end: '17:00' },
  { date: '2026-04-21', start: '19:00', end: '20:00' },
  { date: '2026-04-23', start: '14:00', end: '15:30' },
  { date: '2026-04-23', start: '15:30', end: '17:00' },
  { date: '2026-04-23', start: '17:00', end: '19:00' },
  { date: '2026-04-23', start: '19:00', end: '20:00' },
  { date: '2026-04-26', start: '16:00', end: '17:00' },
  { date: '2026-04-28', start: '19:00', end: '20:00' },
  { date: '2026-05-01', start: '19:00', end: '20:00' },
  { date: '2026-05-03', start: '16:00', end: '17:00' },
  { date: '2026-05-07', start: '17:00', end: '19:00' },
];

export function parseHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

export function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function calcSMA(closes, p) {
  if (closes.length < p) return null;
  return closes.slice(-p).reduce((a, b) => a + b, 0) / p;
}

export function calcEMA(closes, p) {
  const k = 2 / (p + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

export function calcBollinger(closes, period = 20) {
  if (closes.length < period) return { pct: null };
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - mid) ** 2, 0) / period);
  const upper = mid + 2 * std;
  const lower = mid - 2 * std;
  const price = closes[closes.length - 1];
  const pct = (price - lower) / (upper - lower) * 100;
  return { upper, lower, mid, pct };
}

export async function fetchYahooHistory(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const closes = result.indicators?.quote?.[0]?.close?.filter(v => v !== null) || [];
  return { closes, meta: result.meta };
}

export function technicalSignal(closes, price) {
  const rsi = calcRSI(closes);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const boll = calcBollinger(closes);
  const ema12 = closes.length >= 26 ? calcEMA(closes.slice(-26), 12) : null;
  const ema26 = closes.length >= 26 ? calcEMA(closes.slice(-26), 26) : null;
  const macd = ema12 && ema26 ? ema12 - ema26 : null;

  let score = 0;
  const reasons = [];

  if (rsi !== null) {
    if (rsi < 30) { score += 2; reasons.push(`RSI ${rsi.toFixed(0)} — kraftigt oversalgt`); }
    else if (rsi < 45) { score += 1; reasons.push(`RSI ${rsi.toFixed(0)} — svagt oversalgt`); }
    else if (rsi > 70) { score -= 2; reasons.push(`RSI ${rsi.toFixed(0)} — kraftigt overkøbt`); }
    else if (rsi > 60) { score -= 1; reasons.push(`RSI ${rsi.toFixed(0)} — svagt overkøbt`); }
    else reasons.push(`RSI ${rsi.toFixed(0)} — neutral`);
  }

  if (macd !== null) {
    if (macd > 0) { score += 1; reasons.push('MACD positivt momentum'); }
    else { score -= 1; reasons.push('MACD negativt momentum'); }
  }

  if (boll.pct !== null) {
    if (boll.pct < 20) { score += 1; reasons.push(`Bollinger ${boll.pct.toFixed(0)}% — nær underkant`); }
    else if (boll.pct > 80) { score -= 1; reasons.push(`Bollinger ${boll.pct.toFixed(0)}% — nær overkant`); }
  }

  if (sma20 && sma50 && price) {
    if (price > sma20 && sma20 > sma50) { score += 1; reasons.push('Over MA20 og MA50 — opadgående trend'); }
    else if (price < sma20 && sma20 < sma50) { score -= 1; reasons.push('Under MA20 og MA50 — nedadgående trend'); }
  }

  const signal = score >= 2 ? 'KØB' : score <= -2 ? 'SÆLG' : 'HOLD';
  return { signal, score, rsi, macd, boll, sma20, sma50, reasons };
}
