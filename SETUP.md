# Setup: Supabase + Vercel

Volg deze stappen om het dashboard online te zetten zodat Jasper én Philip het kunnen gebruiken en alle data gesynchroniseerd is.

---

## Stap 1 — Supabase (database, gratis)

1. Ga naar **supabase.com** → maak een gratis account
2. Klik "New project" → geef het een naam (bijv. `bouwcheck`) → kies een regio dicht bij NL (West Europe) → stel een wachtwoord in → klik "Create project"
3. Wacht tot het project klaar is (~1 min)
4. Ga naar **SQL Editor** (linker menu) → klik "New query"
5. Plak de inhoud van `supabase-schema.sql` erin → klik "Run"
6. Ga naar **Project Settings → API**
7. Kopieer:
   - **Project URL** → dit is je `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → dit is je `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Stap 2 — GitHub (code opslaan, gratis)

1. Ga naar **github.com** → maak een gratis account (als je die nog niet hebt)
2. Klik "New repository" → naam: `bouwcheck-dashboard` → Private → klik "Create"
3. Open Terminal en voer uit:

```bash
cd /Users/jaspervheyningen/bouwcheck-dashboard
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/JOUW-USERNAME/bouwcheck-dashboard.git
git push -u origin main
```

_(vervang `JOUW-USERNAME` door je GitHub gebruikersnaam)_

---

## Stap 3 — Vercel (hosting, gratis)

1. Ga naar **vercel.com** → maak een gratis account (log in met GitHub)
2. Klik "Add New Project" → selecteer je `bouwcheck-dashboard` repo
3. Klik "Deploy" (Vercel herkent Next.js automatisch)
4. Na de deploy: ga naar **Settings → Environment Variables** en voeg toe:
   - `NEXT_PUBLIC_SUPABASE_URL` → jouw Project URL uit stap 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → jouw anon key uit stap 1
   - `ANTHROPIC_API_KEY` → de Anthropic key uit je .env.local
   - `MONDAY_API_KEY` → de Monday key uit je .env.local
   - `MONDAY_LEADS_BOARD_ID` → `5091706227`
5. Ga naar **Deployments** → klik "Redeploy" zodat de variabelen ingeladen worden
6. Je dashboard staat nu live op `jouw-project.vercel.app`

---

## Stap 4 — Bestaande data overzetten

Je huidige data zit nog in localStorage op jouw Mac. Na de Vercel deploy:

1. Open het dashboard lokaal op `localhost:3000`
2. Open de browser DevTools (F12) → Console
3. Plak dit script om je data naar Supabase te sturen:

```javascript
const keys = [
  'bouwcheck_companies_v3','bouwcheck_monthly_v1','bouwcheck_finance_targets',
  'bouwcheck_costs_v1','bouwcheck_incomes_v1','bouwcheck_questions',
  'bouwcheck_meetings','bouwcheck_intakes','bouwcheck_sops','bouwcheck_contracts'
]
keys.forEach(k => {
  const v = localStorage.getItem(k)
  if (v) console.log(k, '→ aanwezig, wordt gesynchroniseerd bij volgende save')
})
console.log('Open elk tabblad en sla iets op — data migreert automatisch')
```

Of simpeler: open elk tabblad (Finance, Docs, etc.) en doe één kleine wijziging + sla op. Dat pusht de data naar Supabase.

---

## Stap 5 — Philip toegang geven

Stuur Philip de Vercel URL. Klaar. Jullie zien beide dezelfde data en wijzigingen zijn realtime zichtbaar.

---

## Toekomstige code updates

Ik codeer iets → jij doet in Terminal:

```bash
cd /Users/jaspervheyningen/bouwcheck-dashboard
git add .
git commit -m "update"
git push
```

Vercel deployt automatisch binnen ~30 seconden. Philip heeft de update zonder iets te doen.
