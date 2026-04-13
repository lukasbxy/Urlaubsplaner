# AGENTS.md – Urlaubsplaner

Kurzanleitung für menschliche Entwickler und KI-Assistenten, die an diesem Repository arbeiten.

## Was ist das Projekt?

**Urlaubsplaner** ist eine React- und Vite-basierte Single-Page-App zum Planen von Reisen. Daten liegen in **Supabase** (PostgreSQL). Authentifizierung erfolgt über **Supabase Auth** (`signInWithOAuth`; der Anbieter wird in der Supabase-Konsole konfiguriert). Es gibt **keine Firebase-Integration** mehr: Client, Dependencies und Konfiguration beziehen sich ausschließlich auf Supabase.

## Dev-Server und Workflow

- Nach inhaltlichen Änderungen vor dem lokalen Test idealerweise **`npm run build`** ausführen, danach **`npm run dev`**.
- Dev-Server starten: `npm run dev`
- Standard-URL: **http://localhost:3000/**
- Die Meldung **„Unsafe attempt to load URL“** mit `chrome-error://chromewebdata` entsteht typischerweise, wenn ein ungültiger oder leerer Link geöffnet wurde. **Kein App-Bug:** Nutzer soll die App direkt unter `http://localhost:3000/` aufrufen.

## Produktionsbuild

Vite liest Umgebungsvariablen **beim Build** ein und ersetzt `import.meta.env.VITE_*` im Bundle. Ohne passende Werte bricht der Client beim Start ab (Absicht: keine Supabase-Keys im Repo für Production).

**Pflicht für `npm run build` (Mode `production`):**

| Variable | Bedeutung |
|----------|-----------|
| `VITE_SUPABASE_URL` | Projekt-URL aus der Supabase-Konsole |
| `VITE_SUPABASE_ANON_KEY` | Anon (public) Key, nicht der Service-Role-Key |

**Weitere Variablen** wie `VITE_GOOGLE_MAPS_API_KEY` nur setzen, wenn die App sie wirklich braucht (siehe `.env.example`).

**Lokal einen Production-Build erzeugen:**

1. **Variante A:** Datei **`.env.production`** im Projektroot anlegen (steht typischerweise in `.gitignore`, nicht committen) mit den `VITE_*`-Zeilen, dann:

   ```bash
   npm run build
   ```

2. **Variante B:** Variablen nur für diesen Shell-Aufruf setzen:

   ```bash
   export VITE_SUPABASE_URL="https://<ref>.supabase.co"
   export VITE_SUPABASE_ANON_KEY="<anon-key>"
   npm run build
   ```

**CI / Hosting:** Dieselben Namen als Build-Umgebungsvariablen bzw. Secrets (siehe README: GitHub Pages Workflow).

**Build prüfen:** `npm run preview` startet einen lokalen Server für `dist/` (gleiches Bundle wie in Production).

**Entwicklung:** `npm run dev` braucht ebenfalls `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (z. B. in `.env`). Ohne diese Werte schlägt das Laden des Clients fehl.

## Wichtige Dateien

| Datei / Ordner | Rolle |
|----------------|--------|
| `src/lib/supabase.ts` | Einziger Supabase-Client (`createClient`), Typen für `trips`, `items`, `todos` |
| `src/components/AuthProvider.tsx` | Session, 24h-Wall-Clock-Logout, `getSession` / `onAuthStateChange` |
| `src/App.tsx` | Login (`signInWithOAuth`), Logout, Dashboard vs. TripView |
| `supabase/migrations/` | Schema; `20260413200000_restore_rls.sql` aktiviert RLS für Produktion wieder |
| `.env.example` | Vorlage für `VITE_*` und weitere Variablen |

## Backend und Auth

- **Nur Supabase:** Keine `firebase`-Pakete, keine `firebase-applet-config`, kein Firestore.
- OAuth-Redirect-URLs in der Supabase-Konsole müssen zu der tatsächlichen App-URL passen (lokal und Produktion).
- `owner_id` und `collaborator_ids` in `trips` sind an die Auth-User-IDs gekoppelt; bei aktivem RLS müssen Policies zu `auth.uid()` passen.

## Häufige Probleme und Fixes

1. **Lat/Lng-Validierung:** Sicherstellen, dass Koordinaten echte Zahlen sind (nicht `null`, `undefined`, `NaN`).
2. **Karten-Verbindungslinien:** Nur für passende Item-Typen anzeigen (z. B. Flug, Zug, Transport), nicht für jeden Typ.
3. **Build-Typfehler:** `npm run lint` (`tsc --noEmit`) nutzen.
4. **Supabase-Zugriff:** Details siehe Abschnitt **Produktionsbuild**; Kurzfassung: Produktionsbuild braucht immer `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`.

## Qualität und Scope

- Änderungen **fokussiert** halten: keine großen Refactorings ohne Auftrag.
- Bestehende Namenskonventionen, Imports und UI-Muster in `src/components/` übernehmen.
- Sensible Keys oder Service-Role-Credentials **nicht** in den Client-Code oder öffentliche Commits legen.

## Nützliche Befehle

```bash
npm run dev      # Entwicklung (Mode development)
npm run build    # Produktion: VITE_* vorher setzen (siehe Abschnitt Produktionsbuild)
npm run preview  # dist/ wie nach Deployment testen
npm run lint     # Typecheck
```

## Sicherheitshinweis für Agents

Reihenfolge: `20260413124846_remove_rls.sql` schaltet RLS ab (Demo), `20260413200000_restore_rls.sql` schaltet es für Produktion wieder ein. Nach Restore: Migration auf dem Projekt ausführen (`supabase db push` oder SQL). Zusätzlich in der Supabase-Konsole Auth-Härtung (Rate Limits, ggf. CAPTCHA) prüfen.
