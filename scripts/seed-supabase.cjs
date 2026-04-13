const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://REDACTED_PROJECT_REF.supabase.co';
const supabaseKey = 'REMOVED_JWT';

const supabase = createClient(supabaseUrl, supabaseKey);

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function seed() {
  console.log('Seeding database...');
  
  const tripId = uuidv4();

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      id: tripId,
      title: 'Deutschland & Skandinavien',
      description: 'Roadtrip durch Deutschland, Schweden, Finnland und Polen',
      start_date: '2026-06-15T00:00:00Z',
      end_date: '2026-07-10T00:00:00Z',
      owner_id: 'demo-user',
      collaborator_ids: ['demo-user'],
      created_at: new Date().toISOString(),
      flight_cost: 450,
      train_cost: 200,
      transport_cost: 150
    })
    .select()
    .single();

  if (tripError) console.log('Trip error:', tripError);
  else console.log('Trip created:', trip?.id);

  const items = [
    { trip_id: tripId, type: 'flight', title: 'Flug nach Berlin', location_name: 'München Hauptbahnhof', start_time: '2026-06-15T08:00:00Z', end_time: '2026-06-15T09:30:00Z', item_order: 0, lat: 52.52, lng: 13.405 },
    { trip_id: tripId, type: 'location', title: 'Brandenburger Tor', location_name: 'Pariser Platz, Berlin', start_time: '2026-06-15T10:00:00Z', end_time: '2026-06-15T12:00:00Z', item_order: 1, lat: 52.5163, lng: 13.3777 },
    { trip_id: tripId, type: 'accommodation', title: 'Hotel Berlin', location_name: 'Berlin', start_time: '2026-06-15T14:00:00Z', end_time: '2026-06-17T10:00:00Z', item_order: 2, lat: 52.52, lng: 13.405 },
    { trip_id: tripId, type: 'train', title: 'Nachtzug nach Kopenhagen', location_name: 'Berlin Hauptbahnhof', end_location_name: 'Kopenhagen', start_time: '2026-06-17T21:00:00Z', end_time: '2026-06-18T08:00:00Z', item_order: 3, lat: 52.52, lng: 13.405, end_lat: 55.6761, end_lng: 12.5681 },
    { trip_id: tripId, type: 'transport', title: 'Fähre nach Malmö', location_name: 'Kopenhagen Hafen', end_location_name: 'Malmö', start_time: '2026-06-18T10:00:00Z', end_time: '2026-06-18T14:00:00Z', item_order: 4, lat: 55.6761, lng: 12.5681, end_lat: 55.6045, end_lng: 13.0038 },
    { trip_id: tripId, type: 'location', title: 'Malmö Stortorget', location_name: 'Malmö', start_time: '2026-06-18T15:00:00Z', end_time: '2026-06-18T17:00:00Z', item_order: 5, lat: 55.6045, lng: 13.0038 },
    { trip_id: tripId, type: 'transport', title: 'Mietwagen Malmö', location_name: 'Malmö', start_time: '2026-06-18T18:00:00Z', end_time: '2026-06-22T10:00:00Z', item_order: 6, lat: 55.6045, lng: 13.0038 },
    { trip_id: tripId, type: 'location', title: 'Göteborg Hafen', location_name: 'Göteborg', start_time: '2026-06-20T10:00:00Z', end_time: '2026-06-20T12:00:00Z', item_order: 7, lat: 57.7089, lng: 11.9746 },
    { trip_id: tripId, type: 'location', title: 'Stockholm Altstadt', location_name: 'Stockholm', start_time: '2026-06-21T10:00:00Z', end_time: '2026-06-21T14:00:00Z', item_order: 8, lat: 59.3293, lng: 18.0686 },
    { trip_id: tripId, type: 'flight', title: 'Flug nach Helsinki', location_name: 'Stockholm Arlanda', start_time: '2026-06-22T08:00:00Z', end_time: '2026-06-22T10:30:00Z', item_order: 9, lat: 59.6492, lng: 17.9446 },
    { trip_id: tripId, type: 'location', title: 'Marktplatz Helsinki', location_name: 'Helsinki', start_time: '2026-06-22T11:00:00Z', end_time: '2026-06-22T13:00:00Z', item_order: 10, lat: 60.1699, lng: 24.9384 },
    { trip_id: tripId, type: 'location', title: 'Suomenlinna', location_name: 'Helsinki', start_time: '2026-06-23T10:00:00Z', end_time: '2026-06-23T14:00:00Z', item_order: 11, lat: 60.0905, lng: 25.0032 },
    { trip_id: tripId, type: 'location', title: 'Rovaniemi', location_name: 'Rovaniemi', start_time: '2026-06-24T10:00:00Z', end_time: '2026-06-25T12:00:00Z', item_order: 12, lat: 66.5039, lng: 25.7294 },
    { trip_id: tripId, type: 'flight', title: 'Flug nach Danzig', location_name: 'Helsinki', start_time: '2026-06-26T08:00:00Z', end_time: '2026-06-26T09:00:00Z', item_order: 13, lat: 60.1699, lng: 24.9384 },
    { trip_id: tripId, type: 'location', title: 'Danzig Altstadt', location_name: 'Danzig', start_time: '2026-06-26T10:00:00Z', end_time: '2026-06-26T14:00:00Z', item_order: 14, lat: 54.352, lng: 18.6466 },
    { trip_id: tripId, type: 'location', title: 'Warschau', location_name: 'Warschau', start_time: '2026-06-27T10:00:00Z', end_time: '2026-06-28T12:00:00Z', item_order: 15, lat: 52.2297, lng: 21.0122 },
    { trip_id: tripId, type: 'train', title: 'Rückfahrt nach Berlin', location_name: 'Warschau', end_location_name: 'Berlin', start_time: '2026-07-01T10:00:00Z', end_time: '2026-07-01T18:00:00Z', item_order: 16, lat: 52.2297, lng: 21.0122, end_lat: 52.52, end_lng: 13.405 },
    { trip_id: tripId, type: 'location', title: 'Zurück in München', location_name: 'München', start_time: '2026-07-02T10:00:00Z', end_time: '2026-07-02T12:00:00Z', item_order: 17, lat: 48.1351, lng: 11.582 }
  ];

  const { error: itemsError } = await supabase.from('items').insert(items);
  if (itemsError) console.log('Items error:', itemsError);
  else console.log(`Inserted ${items.length} items`);

  const todos = [
    { trip_id: tripId, text: 'Mietwagen in Malmö buchen', completed: false, todo_order: 0 },
    { trip_id: tripId, text: 'Fähre Malmö buchen', completed: true, todo_order: 1 },
    { trip_id: tripId, text: 'Hotel Helsinki buchen', completed: false, todo_order: 2 },
    { trip_id: tripId, text: 'Reisepass verlängern', completed: false, todo_order: 3 },
    { trip_id: tripId, text: 'Schweden Kronen wechseln', completed: false, todo_order: 4 },
    { trip_id: tripId, text: 'Wetter in Helsinki prüfen', completed: false, todo_order: 5 }
  ];

  const { error: todosError } = await supabase.from('todos').insert(todos);
  if (todosError) console.log('Todos error:', todosError);
  else console.log(`Inserted ${todos.length} todos`);

  console.log('✅ Seeding complete!');
}

seed().catch(console.error);