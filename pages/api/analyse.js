// pages/api/analyse.js
// Kør teknisk analyse + nyhedsanalyse og send email
// Kaldes automatisk af Vercel Cron dagligt

import Anthropic from '@anthropic-ai/sdk';
import {
  HOLDINGS, SHIFTS, parseHours,
  fetchYahooHistory, technicalSignal
} from '../../lib/analysis';
import { buildEmailHTML, sendEmail } from '../../lib/email';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const NEWS_SEARCHES = {
  'NKT': 'NKT kabel aktie nyheder',
  'Kongsberg Gruppen': 'Kongsberg Gruppen forsvar nyheder',
  'Kongsberg Maritime': 'Kongsberg Maritime nyheder',
  'SAAB B': 'SAAB forsvar aktie nyheder',
  'Novo Nordisk B': 'Novo Nordisk Ozempic nyheder',
  'Tesla': 'Tesla Elon Musk aktie nyheder',
  'Oklo A': 'Oklo nuclear energy stock news',
  'Coinbase': 'Coinbase crypto news',
  'Take-Two': 'Take-Two Interactive GTA nyheder',
  'Thales': 'Thales defense tech nyheder',
  'thyssenkrupp': 'thyssenkrupp stål nyheder',
};

async function analyseNewsForStock(name, search) {
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: 'Du er en finansiel analytiker. Søg efter aktuelle nyheder og returner KUN valid JSON uden markdown. Svar altid på dansk.',
      messages: [{
        role: 'user',
        content: `Søg efter de seneste nyheder om "${search}" de seneste 7 dage og returner JSON:
{"verdict":"KØB"/"HOLD"/"SÆLG","reason":"2-3 sætninger","news":[{"headline":"...","sentiment":"positiv/negativ/neutral"}],"risk":"1 sætning"}`
      }]
    });

    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return { name, ...parsed };
  } catch { return null; }
}

async function getMacro() {
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: 'Du er en markedsanalytiker. Svar på dansk i 3-4 sætninger.',
      messages: [{
        role: 'user',
        content: 'Søg efter dagens globale markedsstemning, vigtige geopolitiske begivenheder der påvirker europæiske og amerikanske aktier, og rente/inflationsudvikling. Beskriv det kort og konkret.'
      }]
    });
    return msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch { return null; }
}

export default async function handler(req, res) {
  // Sikkerhed: tjek secret header (sæt CRON_SECRET i Vercel env)
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== 'development') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔍 Starter analyse...');

    // 1. Teknisk analyse for alle aktier
    const technicalResults = [];
    for (const h of HOLDINGS.filter(h => h.ticker)) {
      try {
        const data = await fetchYahooHistory(h.ticker);
        if (!data || data.closes.length < 20) continue;
        const { closes, meta } = data;
        const price = meta.regularMarketPrice;
        const prev = meta.previousClose || price;
        const sig = technicalSignal(closes, price);
        technicalResults.push({
          name: h.name,
          ticker: h.ticker,
          price,
          prev,
          dayChg: ((price - prev) / prev * 100),
          currency: meta.currency,
          ...sig,
        });
      } catch (e) {
        console.error(`Fejl for ${h.ticker}:`, e.message);
      }
    }

    // 2. Makroanalyse
    console.log('🌍 Henter makrodata...');
    const macro = await getMacro();

    // 3. Nyhedsanalyse (kun aktier med stærke tekniske signaler + alle for ugentlig)
    const isWeekly = new Date().getDay() === 1; // Mandag = ugentlig fuld rapport
    const strongSignals = technicalResults.filter(r => Math.abs(r.score) >= 2);
    const toAnalyse = isWeekly
      ? HOLDINGS.filter(h => h.ticker && NEWS_SEARCHES[h.name])
      : strongSignals;

    console.log(`📰 Analyserer nyheder for ${toAnalyse.length} aktier...`);
    const newsResults = [];
    for (const h of toAnalyse) {
      const search = NEWS_SEARCHES[h.name];
      if (!search) continue;
      const result = await analyseNewsForStock(h.name, search);
      if (result) newsResults.push(result);
      await new Promise(r => setTimeout(r, 500)); // rate limit
    }

    // 4. Byg og send email
    const cash = parseInt(process.env.NORDNET_CASH || '3706');
    const strongBuys = technicalResults.filter(r => r.signal === 'KØB');
    const strongSells = technicalResults.filter(r => r.signal === 'SÆLG');
    const newsBuys = newsResults.filter(r => r.verdict === 'KØB');

    // Send email hvis: det er mandag (ugentlig) ELLER der er stærke signaler
    const shouldSend = isWeekly || strongBuys.length > 0 || strongSells.length > 0 || newsBuys.length > 0;

    if (shouldSend) {
      const subject = isWeekly
        ? `📊 Ugentlig porteføljeanalyse — ${strongBuys.length} køb, ${strongSells.length} sælg`
        : `🚨 Alert: ${strongBuys.length} køb-signaler, ${strongSells.length} sælg-signaler`;

      const html = buildEmailHTML({
        technicalResults,
        newsResults,
        macro,
        cash,
        shifts: SHIFTS,
        parseHours,
      });

      await sendEmail({ subject, html });
      console.log('✅ Email sendt:', subject);
    } else {
      console.log('ℹ️ Ingen stærke signaler — email ikke sendt');
    }

    return res.status(200).json({
      ok: true,
      technicalResults: technicalResults.length,
      newsResults: newsResults.length,
      emailSent: shouldSend,
      strongBuys: strongBuys.map(r => r.name),
      strongSells: strongSells.map(r => r.name),
    });

  } catch (err) {
    console.error('Fejl i analyse:', err);
    return res.status(500).json({ error: err.message });
  }
}
