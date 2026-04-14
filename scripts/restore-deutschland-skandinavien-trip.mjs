/**
 * Einmaliges Wiederherstellen der Demo-Route „Deutschland & Skandinavien“
 * (Schweden, Berlin, …) nach versehentlichem Löschen.
 *
 * Nutzung (im Projektroot):
 *   node scripts/restore-deutschland-skandinavien-trip.mjs
 *
 * Service-Role-Key wird per Supabase CLI geholt (gleiche Session wie `supabase link`).
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const PROJECT_REF = 'qcrgccepqmbkddfacvef';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

function getServiceRoleKey() {
  const out = execSync(`supabase projects api-keys --project-ref ${PROJECT_REF} -o json`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const keys = JSON.parse(out);
  const legacy = keys.find((k) => k.name === 'service_role' && k.api_key?.startsWith('eyJ'));
  if (legacy?.api_key) return legacy.api_key;
  const secret = keys.find((k) => k.type === 'secret' && k.api_key && !k.api_key.includes('·'));
  if (secret?.api_key) return secret.api_key;
  throw new Error('Kein service_role Key gefunden (supabase login?).');
}

const OWNER_ID = 'ae522c00-6b4a-40b0-925d-db34f5910d94';

const TRIP = {
  title: 'Deutschland & Skandinavien',
  description: 'Roadtrip durch Deutschland, Schweden, Finnland und Polen',
  start_date: '2026-06-15T00:00:00.000Z',
  end_date: '2026-07-10T00:00:00.000Z',
  owner_id: OWNER_ID,
  collaborator_ids: [OWNER_ID],
  flight_cost: 450,
  train_cost: 200,
  transport_cost: 150,
};

/** Reihenfolge wie früher in seed.sql; „ferry“ → transport (App-Typen). */
const ITEMS = [
  { type: 'flight', title: 'Flug nach Berlin', location_name: 'München Hauptbahnhof', start_time: '2026-06-15T08:00:00.000Z', end_time: '2026-06-15T09:30:00.000Z', lat: 52.52, lng: 13.405 },
  { type: 'location', title: 'Brandenburger Tor', location_name: 'Pariser Platz, Berlin', start_time: '2026-06-15T10:00:00.000Z', end_time: '2026-06-15T12:00:00.000Z', lat: 52.5163, lng: 13.3777 },
  { type: 'accommodation', title: 'Hotel Berlin', location_name: 'Berlin', start_time: '2026-06-15T14:00:00.000Z', end_time: '2026-06-17T10:00:00.000Z', lat: 52.52, lng: 13.405 },
  { type: 'train', title: 'Nachtzug nach Kopenhagen', location_name: 'Berlin Hauptbahnhof', start_time: '2026-06-17T21:00:00.000Z', end_time: '2026-06-18T08:00:00.000Z', lat: 52.52, lng: 13.405, end_location_name: 'Kopenhagen', end_lat: 55.6761, end_lng: 12.5681 },
  { type: 'transport', title: 'Fähre nach Malmö', location_name: 'Kopenhagen Hafen', start_time: '2026-06-18T10:00:00.000Z', end_time: '2026-06-18T14:00:00.000Z', lat: 55.6761, lng: 12.5681, end_location_name: 'Malmö', end_lat: 55.6045, end_lng: 13.0038 },
  { type: 'location', title: 'Malmö Stortorget', location_name: 'Malmö', start_time: '2026-06-18T15:00:00.000Z', end_time: '2026-06-18T17:00:00.000Z', lat: 55.6045, lng: 13.0038 },
  { type: 'transport', title: 'Mietwagen Malmö', location_name: 'Malmö', start_time: '2026-06-18T18:00:00.000Z', end_time: '2026-06-22T10:00:00.000Z', lat: 55.6045, lng: 13.0038 },
  { type: 'location', title: 'Göteborg Hafen', location_name: 'Göteborg', start_time: '2026-06-20T10:00:00.000Z', end_time: '2026-06-20T12:00:00.000Z', lat: 57.7089, lng: 11.9746 },
  { type: 'location', title: 'Stockholm Altstadt', location_name: 'Stockholm', start_time: '2026-06-21T10:00:00.000Z', end_time: '2026-06-21T14:00:00.000Z', lat: 59.3293, lng: 18.0686 },
  { type: 'flight', title: 'Flug nach Helsinki', location_name: 'Stockholm Arlanda', start_time: '2026-06-22T08:00:00.000Z', end_time: '2026-06-22T10:30:00.000Z', lat: 59.6492, lng: 17.9446 },
  { type: 'location', title: 'Marktplatz Helsinki', location_name: 'Helsinki', start_time: '2026-06-22T11:00:00.000Z', end_time: '2026-06-22T13:00:00.000Z', lat: 60.1699, lng: 24.9384 },
  { type: 'location', title: 'Suomenlinna', location_name: 'Helsinki', start_time: '2026-06-23T10:00:00.000Z', end_time: '2026-06-23T14:00:00.000Z', lat: 60.0905, lng: 25.0032 },
  { type: 'location', title: 'Rovaniemi', location_name: 'Rovaniemi', start_time: '2026-06-24T10:00:00.000Z', end_time: '2026-06-25T12:00:00.000Z', lat: 66.5039, lng: 25.7294 },
  { type: 'flight', title: 'Flug nach Danzig', location_name: 'Helsinki', start_time: '2026-06-26T08:00:00.000Z', end_time: '2026-06-26T09:00:00.000Z', lat: 60.1699, lng: 24.9384 },
  { type: 'location', title: 'Danzig Altstadt', location_name: 'Danzig', start_time: '2026-06-26T10:00:00.000Z', end_time: '2026-06-26T14:00:00.000Z', lat: 54.352, lng: 18.6466 },
  { type: 'location', title: 'Warschau', location_name: 'Warschau', start_time: '2026-06-27T10:00:00.000Z', end_time: '2026-06-28T12:00:00.000Z', lat: 52.2297, lng: 21.0122 },
  { type: 'train', title: 'Rückfahrt nach Berlin', location_name: 'Warschau', start_time: '2026-07-01T10:00:00.000Z', end_time: '2026-07-01T18:00:00.000Z', lat: 52.2297, lng: 21.0122, end_location_name: 'Berlin', end_lat: 52.52, end_lng: 13.405 },
  { type: 'location', title: 'Zurück in München', location_name: 'München', start_time: '2026-07-02T10:00:00.000Z', end_time: '2026-07-02T12:00:00.000Z', lat: 48.1351, lng: 11.582 },
];

const TODOS = [
  { text: 'Mietwagen in Malmö buchen', completed: false, todo_order: 0 },
  { text: 'Fähre Malmö buchen', completed: true, todo_order: 1 },
  { text: 'Hotel Helsinki buchen', completed: false, todo_order: 2 },
  { text: 'Reisepass verlängern', completed: false, todo_order: 3 },
  { text: 'Schweden Kronen wechseln', completed: false, todo_order: 4 },
  { text: 'Wetter in Helsinki prüfen', completed: false, todo_order: 5 },
];

async function main() {
  const key = getServiceRoleKey();
  const sb = createClient(SUPABASE_URL, key);

  const { data: trip, error: tripErr } = await sb.from('trips').insert(TRIP).select('id').single();
  if (tripErr) throw tripErr;
  const tripId = trip.id;
  console.log('Reise angelegt:', tripId);

  const itemsPayload = ITEMS.map((row, i) => ({
    trip_id: tripId,
    item_order: i,
    created_at: new Date().toISOString(),
    is_all_day: false,
    ...row,
  }));

  const { error: itemsErr } = await sb.from('items').insert(itemsPayload);
  if (itemsErr) throw itemsErr;
  console.log('Timeline-Einträge:', itemsPayload.length);

  const todosPayload = TODOS.map((t) => ({
    trip_id: tripId,
    text: t.text,
    completed: t.completed,
    todo_order: t.todo_order,
    created_at: new Date().toISOString(),
  }));
  const { error: todosErr } = await sb.from('todos').insert(todosPayload);
  if (todosErr) throw todosErr;
  console.log('To-Dos:', todosPayload.length);
  console.log('Fertig. Titel in der App: „Deutschland & Skandinavien“.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
