// pages/api/analyse.js — sender ALTID mail når der køres analyse

import Anthropic from '@anthropic-ai/sdk';
import { SHIFTS, parseHours, fetchYahooHistory, technicalSignal } from '../../lib/analysis';
import { sendEmail } from '../../lib/email';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OWNED_STOCKS = [
  { name: 'NKT', ticker: 'NKT.CO', sector: 'Infrastruktur' },
  { name: 'Kongsberg Gruppen', ticker: 'KOG.OL', sector: 'Forsvar' },
  { name: 'Kongsberg Maritime', ticker: 'KMAR.OL', sector: 'Forsvar' },
  { name: 'SAAB B', ticker: 'SAAB-B.ST', sector: 'Forsvar' },
  { name: 'Novo Nordisk B', ticker: 'NOVO-B.CO', sector: 'Sundhed' },
  { name: 'Tesla', ticker: 'TSLA', sector: 'Tech' },
  { name: 'Oklo A', ticker: 'OKLO', sector: 'Energi' },
  { name: 'Coinbase', ticker: 'COIN', sector: 'Finans' },
  { name: 'Take-Two', ticker: 'TTWO', sector: 'Tech' },
  { name: 'Thales', ticker: 'HO.PA', sector: 'Forsvar' },
  { name: 'thyssenkrupp', ticker: 'TKA.DE', sector: 'Industri' },
];

const WATCHLIST = [
  { name: 'Vestas Wind Systems', ticker: 'VWS.CO', sector: 'Energi (vind)' },
  { name: 'Ørsted', ticker: 'ORSTED.CO', sector: 'Energi (vind)' },
  { name: 'Exxon Mobil', ticker: 'XOM', sector: 'Energi (olie)' },
  { name: 'AstraZeneca', ticker: 'AZN', sector: 'Sundhed' },
  { name: 'Coloplast B', ticker: 'COLO-B.CO', sector: 'Sundhed' },
  { name: 'Ambu B', ticker: 'AMBU-B.CO', sector: 'Sundhed' },
  { name: 'Danske Bank', ticker: 'DANSKE.CO', sector: 'Finans' },
  { name: 'DSV', ticker: 'DSV.CO', sector: 'Logistik' },
  { name: 'Rockwool B', ticker: 'ROCK-B.CO', sector: 'Industri' },
  { name: 'ASML', ticker: 'ASML', sector: 'Tech (halvledere)' },
  { name: 'Palantir', ticker: 'PLTR', sector: 'Tech/AI' },
  { name: 'Microsoft', ticker: 'MSFT', sector: 'Tech' },
  { name: 'LVMH', ticker: 'MC.PA', sector: 'Luksus' },
  { name: 'Novonesis', ticker: 'NSIS-B.CO', sector: 'Biotek' },
  { name: 'A.P. Møller-Mærsk B', ticker: 'MAERSK-B.CO', sector: 'Transport' },
];

const GOLD_GRAMS = 7.5 + 31.1035 / 20;
const FX = { USD: 6.85, EUR: 7.46, SEK: 0.645, NOK: 0.625, GBP: 8.6, DKK: 1 };
function toDKK(price, currency) { return price * (FX[currency] || 1); }

async function getMacro() {
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: 'Du er en markedsanalytiker. Svar på dansk i 2-3 sætninger.',
      messages: [{ role: 'user', content: 'Søg efter dagens vigtigste globale markedsnyheder der påvirker aktier. Beskriv kort og konkret.' }]
    });
    return msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch { return null; }
}

async function getGoldPrice() {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=2d';
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const pricePerGram = (meta.regularMarketPrice / 31.1035) * FX.USD;
    const prevPerGram = (meta.previousClose / 31.1035) * FX.USD;
    const dayChg = ((pricePerGram - prevPerGram) / prevPerGram * 100);
    const totalValue = pricePerGram * GOLD_GRAMS;
    return { pricePerGram, dayChg, totalValue };
  } catch { return null; }
}

async function findNewCandidates(availableCash, ownedSectors) {
  const overweight = ['Forsvar'];
  const candidates = [];
  for (const stock of WATCHLIST) {
    try {
      const data = await fetchYahooHistory(stock.ticker);
      if (!data || data.closes.length < 20) continue;
      const price = data.meta.regularMarketPrice;
      const currency = data.meta.currency;
      const priceDKK = toDKK(price, currency);
      if (priceDKK > availableCash) continue;
      const kurtageEats = (39 / priceDKK) * 100;
      if (kurtageEats > 2) continue;
      const sig = technicalSignal(data.closes, price);
      if (sig.signal !== 'KØB') continue;
      let adjustedScore = sig.score;
      if (overweight.includes(stock.sector)) adjustedScore -= 1;
      if (!ownedSectors.includes(stock.sector)) adjustedScore += 1;
      candidates.push({ ...stock, price, priceDKK, currency, kurtageEats: kurtageEats.toFixed(2), ...sig, adjustedScore });
    } catch { continue; }
  }
  return candidates.sort((a, b) => b.adjustedScore - a.adjustedScore).slice(0, 4);
}

function buildEmail({ macro, newCandidates, ownedSignals, cash, availableToInvest, dateStr, gold }) {
  const buyOwned = ownedSignals.filter(r => r.signal === 'KØB');
  const sellOwned = ownedSignals.filter(r => r.signal === 'SÆLG');
  const holdOwned = ownedSignals.filter(r => r.signal === 'HOLD');

  const candidateHTML = newCandidates.map(c => `
    <div style="padding:14px;border:1px solid #e8e8e8;border-radius:10px;margin-bottom:10px;border-left:4px solid #1D9E75">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <div><strong style="font-size:15px">${c.name}</strong> <span style="color:#888;font-size:12px">${c.ticker} · ${c.sector}</span></div>
        <span style="background:#EAF3DE;color:#2d6a2d;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">🟢 KØB</span>
      </div>
      <div style="margin-top:8px;font-size:13px;color:#444">
        Kurs: <strong>${c.price.toFixed(2)} ${c.currency}</strong> (≈ ${Math.round(c.priceDKK).toLocaleString('da-DK')} kr) · RSI: <strong>${c.rsi?.toFixed(0) || '—'}</strong> · Kurtage: <strong>${c.kurtageEats}% af køb</strong>
      </div>
      <div style="margin-top:5px;font-size:12px;color:#666">${c.reasons?.slice(0, 2).join(' · ')}</div>
    </div>`).join('');

  const allOwnedRows = ownedSignals.map(r => {
    const sigColor = r.signal === 'KØB' ? '#1D9E75' : r.signal === 'SÆLG' ? '#D85A30' : '#888';
    const sigEmoji = r.signal === 'KØB' ? '🟢' : r.signal === 'SÆLG' ? '🔴' : '🟡';
    return `<tr style="border-bottom:1px solid #f5f5f5">
      <td style="padding:8px 12px;font-weight:500">${r.name}</td>
      <td style="padding:8px 12px;color:#888;font-size:12px">${r.ticker}</td>
      <td style="padding:8px 12px;color:${r.dayChg >= 0 ? '#1D9E75' : '#D85A30'}">${r.dayChg >= 0 ? '+' : ''}${r.dayChg?.toFixed(2)}%</td>
      <td style="padding:8px 12px">${r.rsi?.toFixed(0) || '—'}</td>
      <td style="padding:8px 12px;color:${sigColor};font-weight:600">${sigEmoji} ${r.signal}</td>
    </tr>`;
  }).join('');

  const goldHTML = gold ? `
    <div class="card">
      <h2>🥇 Guld</h2>
      <div style="font-size:13px;color:#444;line-height:1.8">
        Pris per gram: <strong>${Math.round(gold.pricePerGram).toLocaleString('da-DK')} kr</strong>
        <span style="color:${gold.dayChg >= 0 ? '#1D9E75' : '#D85A30'};margin-left:8px">${gold.dayChg >= 0 ? '+' : ''}${gold.dayChg.toFixed(2)}% i dag</span><br>
        Din beholdning (${GOLD_GRAMS.toFixed(3)} g): <strong>${Math.round(gold.totalValue).toLocaleString('da-DK')} kr</strong>
      </div>
    </div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1a1a1a;max-width:620px;margin:0 auto;padding:20px;background:#f7f7f7}
    .card{background:white;border-radius:12px;padding:20px 24px;margin-bottom:14px;border:1px solid #eee}
    h2{font-size:16px;margin:0 0 14px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:8px 12px;background:#f5f5f5;font-size:12px;color:#666}
    .footer{font-size:11px;color:#bbb;text-align:center;margin-top:20px;line-height:1.8}
  </style></head><body>

  <div class="card">
    <div style="font-size:12px;color:#888;margin-bottom:4px">${dateStr}</div>
    <div style="font-size:22px;font-weight:700;margin-bottom:6px">📊 Porteføljeanalyse</div>
    <div style="font-size:13px;color:#555">${newCandidates.length} nye muligheder · ${buyOwned.length} køb · ${sellOwned.length} sælg · ${holdOwned.length} hold</div>
  </div>

  <div class="card">
    <div style="font-size:13px;color:#666;margin-bottom:4px">Klar til investering</div>
    <div style="font-size:30px;font-weight:700;color:#1D9E75">${Math.round(availableToInvest).toLocaleString('da-DK')} kr</div>
    <div style="font-size:12px;color:#999;margin-top:4px">${Math.round(cash).toLocaleString('da-DK')} kr kontanter på Nordnet</div>
  </div>

  ${macro ? `<div class="card"><h2>🌍 Markedssituation</h2><p style="font-size:13px;color:#444;line-height:1.7;margin:0">${macro}</p></div>` : ''}

  ${newCandidates.length ? `<div class="card">
    <h2>✨ Nye købsmuligheder</h2>
    <p style="font-size:12px;color:#888;margin:-6px 0 14px">Passer til dine kontanter · kurtage under 2% · god teknisk analyse</p>
    ${candidateHTML}
  </div>` : '<div class="card"><h2>✨ Nye købsmuligheder</h2><p style="font-size:13px;color:#888;margin:0">Ingen nye aktier opfylder kriterierne i dag.</p></div>'}

  <div class="card">
    <h2>📋 Din portefølje</h2>
    <table>
      <tr><th>Aktie</th><th>Ticker</th><th>I dag</th><th>RSI</th><th>Signal</th></tr>
      ${allOwnedRows}
    </table>
  </div>

  ${goldHTML}

  <div class="footer">
    Automatisk teknisk analyse · Ikke finansiel rådgivning<br>
    Nordnets minimumskurtage: 39 kr · Nordisk Guldss salær: 0,5%
  </div>
  </body></html>`;
}

export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== 'development') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const cash = parseInt(process.env.NORDNET_CASH || '3706');
    const totalHours = SHIFTS.reduce((s, v) => s + parseHours(v.start, v.end), 0);
    const availableToInvest = cash + (totalHours * 65) / 2;

    // 1. Analyser aktier du ejer
    console.log('📈 Analyserer portefølje...');
    const ownedSignals = [];
    for (const s of OWNED_STOCKS) {
      try {
        const data = await fetchYahooHistory(s.ticker);
        if (!data || data.closes.length < 20) continue;
        const price = data.meta.regularMarketPrice;
        const prev = data.meta.previousClose || price;
        const sig = technicalSignal(data.closes, price);
        ownedSignals.push({ ...s, price, prev, dayChg: ((price - prev) / prev * 100), currency: data.meta.currency, ...sig });
      } catch { continue; }
    }

    // 2. Find nye kandidater
    console.log('🔍 Søger nye muligheder...');
    const ownedSectors = [...new Set(OWNED_STOCKS.map(s => s.sector))];
    const newCandidates = await findNewCandidates(availableToInvest, ownedSectors);

    // 3. Guld og makro
    const [gold, macro] = await Promise.all([getGoldPrice(), getMacro()]);

    // 4. Byg emne
    const hasBuy = ownedSignals.some(r => r.signal === 'KØB');
    const hasSell = ownedSignals.some(r => r.signal === 'SÆLG');
    const dateStr = new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });

    const subject = newCandidates.length
      ? `📊 ${newCandidates.length} nye aktier — ${newCandidates.map(c => c.name).join(', ')}`
      : hasBuy || hasSell
        ? `📊 ${hasBuy ? '🟢 Køb' : ''}${hasSell ? ' 🔴 Sælg' : ''} signal — ${dateStr}`
        : `📊 Porteføljeanalyse ${dateStr} — ingen stærke signaler`;

    // 5. Send ALTID email
    const html = buildEmail({ macro, newCandidates, ownedSignals, cash, availableToInvest, dateStr, gold });
    await sendEmail({ subject, html, to: process.env.ALERT_EMAIL });
    console.log('✅ Email sendt:', subject);

    return res.status(200).json({
      ok: true,
      emailSent: true,
      newCandidates: newCandidates.map(c => c.name),
      buySignals: ownedSignals.filter(r => r.signal === 'KØB').map(r => r.name),
      sellSignals: ownedSignals.filter(r => r.signal === 'SÆLG').map(r => r.name),
      availableToInvest: Math.round(availableToInvest),
    });

  } catch (err) {
    console.error('Fejl:', err);
    return res.status(500).json({ error: err.message });
  }
}
