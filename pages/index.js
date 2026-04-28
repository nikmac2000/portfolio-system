// pages/index.js — Simpelt dashboard til at trigge analyser manuelt

import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/analyse?secret=' + process.env.NEXT_PUBLIC_CRON_SECRET);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 600, margin: '60px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>📊 Portfolio System</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Analysen kører automatisk hver hverdag kl. 07:00.<br />
        Du kan også trigge den manuelt herunder.
      </p>

      <div style={{ background: '#f5f5f5', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Automatisk køreplan</h2>
        <div style={{ fontSize: 14, lineHeight: 2, color: '#444' }}>
          🕖 <strong>Hverdage kl. 07:00</strong> — Teknisk analyse af alle aktier<br />
          📰 <strong>Ved stærke signaler</strong> — Nyhedsanalyse + email alert<br />
          📅 <strong>Mandag kl. 07:00</strong> — Fuld ugentlig rapport med alle nyheder<br />
          💰 <strong>D. 19 hver måned</strong> — Lønklar-besked med investeringsbeløb
        </div>
      </div>

      <button
        onClick={runAnalysis}
        disabled={loading}
        style={{
          background: loading ? '#ccc' : '#1a1a1a',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '12px 24px',
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: 20,
        }}
      >
        {loading ? '⏳ Analyserer...' : '🔍 Kør analyse nu'}
      </button>

      {result && (
        <div style={{ background: '#EAF3DE', borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: '#2d6a2d', marginBottom: 12 }}>✅ Analyse færdig!</h3>
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>
            <div>📈 Analyserede aktier: <strong>{result.technicalResults}</strong></div>
            <div>📰 Nyheder hentet: <strong>{result.newsResults}</strong></div>
            <div>📧 Email sendt: <strong>{result.emailSent ? 'Ja' : 'Nej (ingen stærke signaler)'}</strong></div>
            {result.strongBuys?.length > 0 && <div>🟢 Køb: <strong>{result.strongBuys.join(', ')}</strong></div>}
            {result.strongSells?.length > 0 && <div>🔴 Sælg: <strong>{result.strongSells.join(', ')}</strong></div>}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#FCEBEB', borderRadius: 12, padding: 20, color: '#922' }}>
          ❌ Fejl: {error}
        </div>
      )}

      <div style={{ marginTop: 40, fontSize: 12, color: '#aaa', lineHeight: 1.8 }}>
        Emails sendes til: toeretumbler2000@gmail.com<br />
        Aktier: NKT, Kongsberg, SAAB, Novo, Tesla, Oklo, Coinbase, Take-Two, Thales, thyssenkrupp<br />
        Guld: 3×2,5g + 1/20 oz (Nordisk Guld)<br />
        Ikke finansiel rådgivning.
      </div>
    </div>
  );
}
