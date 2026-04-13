# Urlaubsplaner

Web-App zum Planen von Reisen und Urlauben: Trips anlegen, Stationen und Buchungen verwalten, Kartenansicht nutzen und mit anderen Personen an derselben Reise arbeiten. **Persistenz und Anmeldung laufen über [Supabase](https://supabase.com/)** (PostgreSQL, Auth). Es wird **kein Firebase** mehr verwendet.

## Funktionen

- **Google-Anmeldung** über Supabase Auth (`signInWithOAuth` mit Provider `google`)
- **Dashboard** mit Übersicht der eigenen und geteilten Trips
- **Trip-Detailansicht** mit sortierbaren Einträgen (Drag-and-Drop), Kostenfeldern (Flug, Zug, Transport) und To-dos
- **Eintragstypen**: z. B. Ort, Flug, Unterkunft, Aktivität, Transport, Zug (mit optionalen Koordinaten, Zeiten, Buchungsreferenzen, Anhängen)
- **Karte** (Leaflet) und Anbindung an **Google Maps** (Loader, Richtungen je nach Konfiguration)
- **Offline-Hinweis** in der Oberfläche, wenn keine Netzverbindung besteht

## Technologie-Stack

| Bereich | Technologie |
|--------|-------------|
| UI | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS 4, Motion, Lucide |
| Backend | Supabase (PostgREST, Auth) |
| Karten | Leaflet, react-leaflet, Google Maps JS API |
| Formulare / Validierung | react-hook-form, Zod |

## Voraussetzungen

- **Node.js** (aktuelle LTS empfohlen)
- Ein **Supabase-Projekt** mit den Tabellen aus den Migrationen unter `supabase/migrations/`
- Optional: **Google Maps API Key** für Kartenfunktionen
- Optional: **GEMINI_API_KEY** und **APP_URL** (siehe `.env.example`; werden in der Vite-Konfiguration bzw. für externe Integrationen genutzt, sofern vorhanden)

## Installation

```bash
npm install
```

## Umgebungsvariablen

Lege eine lokale Datei **`.env`** oder **`.env.local`** an (Vite lädt `VITE_*` aus der Umgebung). Orientiere dich an [`.env.example`](.env.example).

| Variable | Bedeutung |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL deines Supabase-Projekts |
| `VITE_SUPABASE_ANON_KEY` | Anon/Public Key aus dem Supabase-Dashboard |
| `VITE_GOOGLE_MAPS_API_KEY` | Key für Google Maps (Karte / Dienste) |
| `GEMINI_API_KEY` | Für Gemini / KI-Features, falls genutzt |
| `APP_URL` | Öffentliche Basis-URL der App (z. B. OAuth-Redirects, Links) |
| `VITE_BASE_PATH` | Nur für statisches Hosting unter Unterpfad (z. B. GitHub Pages Projekt-Site). Lokal meist `/` oder weglassen. |

**Hinweis:** Es gibt **keine eingebetteten Supabase-Keys** im Quellcode. URL und Anon-Key kommen nur aus der Umgebung (lokal `.env`, in CI GitHub Secrets).

## Supabase einrichten

1. Projekt in der Supabase-Konsole anlegen.
2. **SQL-Migrationen** ausführen (Reihenfolge beachten):
   - `20260413123651_create_tables.sql` legt `trips`, `items`, `todos` an und aktiviert RLS inkl. Policies.
   - `20260413124846_remove_rls.sql` **deaktiviert RLS** (nur sinnvoll für unkritische Demos).
   - `20260413200000_restore_rls.sql` **stellt RLS und Policies wieder her** (empfohlen für öffentliche Deployments).
3. **Authentication:** Provider **Google** konfigurieren. **Redirect-URLs** müssen exakt passen, z. B.:
   - lokal: `http://localhost:3000`
   - GitHub Pages: `https://<user>.github.io/<repo>/` (ohne Pfadfragment, je nach Supabase-UI ggf. mit abschließendem `/`)
4. Client-seitig `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen.

### Datenmodell (Kurzüberblick)

- **trips**: Titel, Beschreibung, Zeitraum, `owner_id`, `collaborator_ids`, aggregierte Kostenfelder, `created_at`
- **items**: gehört zu einem Trip; Typ, Titel, Zeiten, Orte/Koordinaten, Kosten, Buchung, Reihenfolge, optionale Datei-Metadaten
- **todos**: gehört zu einem Trip; Text, erledigt, Sortierung

Genauere Spalten siehe die Migration `20260413123651_create_tables.sql`.

### Optional: Seed-Daten

Im Ordner `scripts/` liegt `seed-supabase.cjs` zum Befüllen der Datenbank. Setze **`SUPABASE_SERVICE_ROLE_KEY`** und **`SUPABASE_URL`** (oder `VITE_SUPABASE_URL`) in der Umgebung oder in `.env` (nicht committen). Den Service-Role-Key **niemals** ins Repository legen.

## GitHub Actions und GitHub Pages

Das Workflow-File [`.github/workflows/deploy-github-pages.yml`](.github/workflows/deploy-github-pages.yml) baut bei jedem Push auf `main` und veröffentlicht nach **GitHub Pages**.

1. Repository **Settings → Pages**: **Source** auf **GitHub Actions** stellen.
2. **Settings → Secrets and variables → Actions**: folgende **Repository secrets** anlegen:

| Secret | Pflicht | Bedeutung |
|--------|---------|-----------|
| `VITE_SUPABASE_URL` | ja | Supabase-Projekt-URL |
| `VITE_SUPABASE_ANON_KEY` | ja | Anon/Public Key |
| `VITE_GOOGLE_MAPS_API_KEY` | nein | Karten (leer lassen, wenn nicht genutzt) |
| `GEMINI_API_KEY` | nein | nur falls der Build `GEMINI_API_KEY` braucht |

`VITE_BASE_PATH` wird im Workflow automatisch auf `/<Repository-Name>/` gesetzt (Vite-`base` für Projekt-Sites). Nach dem ersten erfolgreichen Lauf zeigt die Pages-URL z. B. `https://<user>.github.io/Urlaubsplaner/`.

Zusätzlich läuft [`.github/workflows/ci.yml`](.github/workflows/ci.yml) mit `npm run lint` auf Push und Pull Requests.

## Entwicklung

```bash
npm run dev
```

Der Dev-Server lauscht standardmäßig auf **Port 3000** (siehe `package.json`: `--host=0.0.0.0`).

```bash
npm run build    # Produktionsbuild nach dist/
npm run preview  # Build lokal testen
npm run lint     # TypeScript-Check (tsc --noEmit)
```

Empfehlung für stabile lokale Tests: zuerst `npm run build`, danach `npm run dev` (siehe auch `AGENTS.md`).

## Projektstruktur (Auszug)

```
src/
  App.tsx              # Routing zwischen Login, Dashboard, TripView
  main.tsx             # Einstieg, inkl. Google-Maps-Init
  components/          # Dashboard, TripView, Map, AuthProvider, UI
  lib/
    supabase.ts        # Supabase-Client und TypeScript-Typen für Tabellen
    googleMapsInit.ts
    drivingDirections.ts
supabase/
  migrations/          # Schema und RLS-Änderungen
```

## Sicherheit und Produktion

- Die Migration `remove_rls` schaltet Row Level Security aus. Das ist für **öffentliche oder Demo-Deployments riskant**. Für Produktion solltest du RLS wieder aktivieren und Policies so definieren, dass Nutzer nur eigene oder freigegebene Trips sehen und bearbeiten können (analog zur ursprünglichen Policy-Logik in der ersten Migration).
- Anon- und Service-Keys nur über sichere Kanäle konfigurieren; Service-Role niemals im Client.

## Bekannte Stolpersteine

- **„Unsafe attempt to load URL“ / chrome-error:** Meist ein kaputter oder leerer Tab-Link. App direkt unter `http://localhost:3000/` öffnen.
- **Koordinaten:** `lat` / `lng` müssen gültige Zahlen sein (kein `null`, `undefined` oder `NaN`), sonst können Validierungs- oder Kartenfehler auftreten.
- **Verbindungslinien auf der Karte:** sollen nur für bestimmte Transporttypen (z. B. Flug, Zug, Transport) erscheinen; Logik in den Trip-/Map-Komponenten beachten.

## Lizenz / Privatsphäre

Das Repository ist als `private` in `package.json` gekennzeichnet. Nutzungs- und Lizenzbedingungen ggf. im eigenen Repo ergänzen.
