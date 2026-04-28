// lib/email.js — Bygger og sender emails via Gmail

import nodemailer from 'nodemailer';

export function buildEmailHTML({ technicalResults, newsResults, macro, cash, shifts, parseHours }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const totalHours = shifts.reduce((s, v) => s + parseHours(v.start, v.end), 0);
  const lon = totalHours * 65;
  const investKlar = cash + lon / 2;

  const techBuys = technicalResults.filter(r => r.signal === 'KØB');
  const techSells = technicalResults.filter(r => r.signal === 'SÆLG');
  const newsBuys = newsResults?.filter(r => r.verdict === 'KØB') || [];
  const newsSells = newsResults?.filter(r => r.verdict === 'SÆLG') || [];

  const allBuys = [...new Set([...techBuys.map(r => r.name), ...newsBuys.map(r => r.name)])];
  const allSells = [...new Set([...techSells.map(r => r.name), ...newsSells.map(r => r.name)])];

  const rows = technicalResults.map(r => {
    const sigColor = r.signal === 'KØB' ? '#1D9E75' : r.signal === 'SÆLG' ? '#D85A30' : '#BA7517';
    const dayStr = r.dayChg !== undefined ? `${r.dayChg >= 0 ? '+' : ''}${r.dayChg?.toFixed(2)}%` : '—';
    const dayColor = r.dayChg >= 0 ? '#1D9E75' : '#D85A30';
    return `<tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:8px 12px;font-weight:500">${r.name}</td>
      <td style="padding:8px 12px;color:#666;font-size:12px">${r.ticker}</td>
      <td style="padding:8px 12px">${r.price?.toFixed(2) || '—'} ${r.currency || ''}</td>
      <td style="padding:8px 12px;color:${dayColor}">${dayStr}</td>
      <td style="padding:8px 12px">${r.rsi?.toFixed(0) || '—'}</td>
      <td style="padding:8px 12px;font-weight:600;color:${sigColor}">${r.signal}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
  .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #eee; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 12px; color: #333; }
  .sub { color: #888; font-size: 13px; }
  .pill { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .buy { background: #EAF3DE; color: #2d6a2d; }
  .sell { background: #FCEBEB; color: #922; }
  .hold { background: #FFF3CD; color: #856404; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; background: #f5f5f5; font-weight: 500; font-size: 12px; color: #666; }
  .invest-amt { font-size: 32px; font-weight: 700; color: #1D9E75; }
  .footer { font-size: 11px; color: #aaa; text-align: center; margin-top: 20px; line-height: 1.6; }
</style></head>
<body>

<div class="card">
  <h1>📊 Porteføljeanalyse</h1>
  <div class="sub">${dateStr}</div>
  <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap">
    <span class="pill buy">🟢 ${allBuys.length} køb</span>
    <span class="pill sell">🔴 ${allSells.length} sælg</span>
    <span class="pill hold">🟡 ${technicalResults.length - allBuys.length - allSells.length} hold</span>
  </div>
</div>

${macro ? `<div class="card">
  <h2>🌍 Makro & verdensituation</h2>
  <p style="color:#444;font-size:13px;line-height:1.7;margin:0">${macro}</p>
</div>` : ''}

${allBuys.length ? `<div class="card" style="border-left:4px solid #1D9E75">
  <h2>🟢 Stærke køb-signaler</h2>
  ${allBuys.map(name => {
    const tech = technicalResults.find(r => r.name === name);
    const news = newsResults?.find(r => r.name === name);
    return `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0">
      <strong>${name}</strong>
      ${tech ? `<span style="color:#666;font-size:12px"> · RSI ${tech.rsi?.toFixed(0)} · ${tech.reasons?.[0] || ''}</span>` : ''}
      ${news ? `<div style="color:#555;font-size:12px;margin-top:4px">📰 ${news.reason}</div>` : ''}
    </div>`;
  }).join('')}
</div>` : ''}

${allSells.length ? `<div class="card" style="border-left:4px solid #D85A30">
  <h2>🔴 Sælg-signaler</h2>
  ${allSells.map(name => {
    const tech = technicalResults.find(r => r.name === name);
    const news = newsResults?.find(r => r.name === name);
    return `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0">
      <strong>${name}</strong>
      ${tech ? `<span style="color:#666;font-size:12px"> · RSI ${tech.rsi?.toFixed(0)} · ${tech.reasons?.[0] || ''}</span>` : ''}
      ${news ? `<div style="color:#555;font-size:12px;margin-top:4px">📰 ${news.reason}</div>` : ''}
    </div>`;
  }).join('')}
</div>` : ''}

<div class="card">
  <h2>📋 Alle positioner</h2>
  <table>
    <tr><th>Aktie</th><th>Ticker</th><th>Kurs</th><th>I dag</th><th>RSI</th><th>Signal</th></tr>
    ${rows}
  </table>
</div>

<div class="card">
  <h2>💰 Løn & investering — 19 apr → 19 maj</h2>
  <p style="font-size:13px;color:#555;margin:0 0 12px">Svømmevagter: <strong>${totalHours.toFixed(1)} timer × 65 kr = ${Math.round(lon).toLocaleString('da-DK')} kr</strong></p>
  <p style="font-size:13px;color:#555;margin:0 0 16px">Kontanter på Nordnet: <strong>${cash.toLocaleString('da-DK')} kr</strong></p>
  <div>Klar til investering d. 19. maj</div>
  <div class="invest-amt">${Math.round(investKlar).toLocaleString('da-DK')} kr</div>
</div>

<div class="footer">
  Denne analyse er automatisk genereret af dit portfolio-system.<br>
  Det er ikke finansiel rådgivning. Husk Nordnets minimumskurtage på 39 kr.<br>
  Generer på: ${now.toLocaleString('da-DK')}
</div>

</body></html>`;
}

export async function sendEmail({ subject, html, to }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Portfolio Alert 📊" <${process.env.GMAIL_USER}>`,
    to: to || process.env.ALERT_EMAIL,
    subject,
    html,
  });
}
