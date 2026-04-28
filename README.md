# 📊 Niklas' Portfolio System

Automatisk teknisk analyse + nyhedsanalyse + email-alerts via Vercel.

---

## 🚀 Opsætning (20 minutter, ingen kodning)

### Trin 1 — Opret GitHub konto (hvis du ikke har en)
Gå til https://github.com og opret en gratis konto.

### Trin 2 — Upload projektet til GitHub
1. Gå til https://github.com/new
2. Kald repository: `portfolio-system`
3. Klik "uploading an existing file"
4. Upload alle filer fra denne mappe
5. Klik "Commit changes"

### Trin 3 — Deploy på Vercel
1. Gå til https://vercel.com og log ind med GitHub
2. Klik "Add New Project"
3. Vælg dit `portfolio-system` repository
4. Klik "Deploy"

### Trin 4 — Tilføj miljøvariabler i Vercel
Gå til dit projekt → Settings → Environment Variables og tilføj:

| Variabel | Værdi | Hvor finder du den |
|----------|-------|-------------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | https://console.anthropic.com |
| `GMAIL_USER` | `toeretumbler2000@gmail.com` | Din email |
| `GMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` | Se nedenfor |
| `ALERT_EMAIL` | `toeretumbler2000@gmail.com` | Din email |
| `NORDNET_CASH` | `3706` | Opdater manuelt |
| `CRON_SECRET` | Valgfrit password | Find på selv, f.eks. `hemmelig123` |
| `NEXT_PUBLIC_CRON_SECRET` | Samme som CRON_SECRET | |

### Gmail App Password
1. Gå til https://myaccount.google.com/security
2. Slå "2-trinsbekræftelse" til (hvis ikke allerede)
3. Gå til https://myaccount.google.com/apppasswords
4. Vælg "Mail" og "Windows Computer"
5. Kopiér det 16-cifrede password

### Trin 5 — Aktiver Vercel Cron
Vercel Free plan inkluderer 2 cron jobs. Din `vercel.json` er allerede sat op til:
- **Hverdage kl. 07:00 UTC** (= 08:00 dansk tid om vinteren, 09:00 om sommeren)

---

## 📧 Hvornår sender systemet emails?

| Situation | Email |
|-----------|-------|
| Mandag morgen | Fuld ugentlig rapport (alle aktier + nyheder) |
| Stærkt køb-signal (RSI < 35, score ≥ 2) | Alert med signal + nyheder |
| Stærkt sælg-signal (RSI > 70, score ≤ -2) | Alert med signal + nyheder |
| Ingen stærke signaler | Ingen email (stille dag) |

---

## 🔧 Opdater dine vagter
Når du får nye vagter fra DGI huset, opdater `SHIFTS` i `lib/analysis.js`.

## 💰 Opdater kontantbeholdning
Gå til Vercel → Settings → Environment Variables → `NORDNET_CASH` → Edit.

---

## 🆘 Hjælp
Noget virker ikke? Tjek Vercel → Deployments → Functions → Logs.
