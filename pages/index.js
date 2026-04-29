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
      const res = await fetch('/api/analyse?secret=megahemmeligt');
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
        Analysen kører automatisk hver hverdag kl. 08:00.<br />
        Tryk herunder for at få en mail med det samme.
      </p>

      <button
        onClick={runAnalysis}
        disabled={loading}
        style={{
          background: loading ? '#ccc' : '#1a1a1a',
          color: 'white', border: 'none', borderRadius: 8,
          padding: '12px 24px', fontSize: 14, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: 20, width: '100%',
        }}
      >
        {loading ? '⏳ Analyserer — vent ca. 1 minut...' : '🔍 Kør analyse og send mail nu'}
      </button>

      {result && (
        <div style={{ background: '#EAF3DE', borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: '#2d6a2d', marginBottom: 12 }}>✅ Mail sendt til din Gmail!</h3>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: '#2d6a2d' }}>
            {result.buySignals?.length > 0 && <div>🟢 Køb: <strong>{result.buySignals.join(', ')}</strong></div>}
            {result.sellSignals?.length > 0 && <div>🔴 Sælg: <strong>{result.sellSignals.join(', ')}</strong></div>}
            {result.newCandidates?.length > 0 && <div>✨ Nye forslag: <strong>{result.newCandidates.join(', ')}</strong></div>}
            {!result.buySignals?.length && !result.sellSignals?.length && !result.newCandidates?.length && (
              <div>🟡 Ingen stærke signaler — tjek mailen for fuld oversigt</div>
            )}
            <div style={{ marginTop: 8 }}>💰 Klar til investering: <strong>{result.availableToInvest?.toLocaleString('da-DK')} kr</strong></div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#FCEBEB', borderRadius: 12, padding: 20, color: '#922' }}>
          ❌ Fejl: {error}
        </div>
      )}
    </div>
  );
}
