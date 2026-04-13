-- Sample trip: Deutschland & Skandinavien
INSERT INTO trips (id, title, description, start_date, end_date, owner_id, collaborator_ids, created_at, flight_cost, train_cost, transport_cost) 
VALUES ('trip-1', 'Deutschland & Skandinavien', 'Roadtrip durch Deutschland, Schweden, Finnland und Polen', '2026-06-15T00:00:00Z', '2026-07-10T00:00:00Z', 'demo-user', ARRAY['demo-user'], NOW(), 450, 200, 150);

-- Items for trip-1: Germany
INSERT INTO items (id, trip_id, type, title, location_name, start_time, end_time, item_order, created_at, lat, lng) 
VALUES 
  ('item-1', 'trip-1', 'flight', 'Flug nach Berlin', 'München Hauptbahnhof', '2026-06-15T08:00:00Z', '2026-06-15T09:30:00Z', 0, NOW(), 52.52, 13.405),
  ('item-2', 'trip-1', 'location', 'Brandenburger Tor', 'Pariser Platz, Berlin', '2026-06-15T10:00:00Z', '2026-06-15T12:00:00Z', 1, NOW(), 52.5163, 13.3777),
  ('item-3', 'trip-1', 'accommodation', 'Hotel Berlin', 'Berlin', '2026-06-15T14:00:00Z', '2026-06-17T10:00:00Z', 2, NOW(), 52.52, 13.405);

-- Items for trip-1: Sweden
INSERT INTO items (id, trip_id, type, title, location_name, start_time, end_time, item_order, created_at, lat, lng, end_location_name, end_lat, end_lng) 
VALUES 
  ('item-4', 'trip-1', 'train', 'Nachtzug nach Kopenhagen', 'Berlin Hauptbahnhof', '2026-06-17T21:00:00Z', '2026-06-18T08:00:00Z', 3, NOW(), 52.52, 13.405, 55.6761, 12.5681),
  ('item-5', 'trip-1', 'ferry', 'Fähre nach Malmö', 'Kopenhagen Hafen', '2026-06-18T10:00:00Z', '2026-06-18T14:00:00Z', 4, NOW(), 55.6761, 12.5681, 55.6045, 13.0038),
  ('item-6', 'trip-1', 'location', 'Malmö Stortorget', 'Malmö', '2026-06-18T15:00:00Z', '2026-06-18T17:00:00Z', 5, NOW(), 55.6045, 13.0038),
  ('item-7', 'trip-1', 'transport', 'Mietwagen Malmö', 'Malmö', '2026-06-18T18:00:00Z', '2026-06-22T10:00:00Z', 6, NOW(), 55.6045, 13.0038),
  ('item-8', 'trip-1', 'location', 'Göteborg Hafen', 'Göteborg', '2026-06-20T10:00:00Z', '2026-06-20T12:00:00Z', 7, NOW(), 57.7089, 11.9746),
  ('item-9', 'trip-1', 'location', 'Stockholm Altstadt', 'Stockholm', '2026-06-21T10:00:00Z', '2026-06-21T14:00:00Z', 8, NOW(), 59.3293, 18.0686);

-- Items for trip-1: Finland
INSERT INTO items (id, trip_id, type, title, location_name, start_time, end_time, item_order, created_at, lat, lng) 
VALUES 
  ('item-10', 'trip-1', 'flight', 'Flug nach Helsinki', 'Stockholm Arlanda', '2026-06-22T08:00:00Z', '2026-06-22T10:30:00Z', 9, NOW(), 59.6492, 17.9446),
  ('item-11', 'trip-1', 'location', 'Marktplatz Helsinki', 'Helsinki', '2026-06-22T11:00:00Z', '2026-06-22T13:00:00Z', 10, NOW(), 60.1699, 24.9384),
  ('item-12', 'trip-1', 'location', 'Suomenlinna', 'Helsinki', '2026-06-23T10:00:00Z', '2026-06-23T14:00:00Z', 11, NOW(), 60.0905, 25.0032),
  ('item-13', 'trip-1', 'location', 'Rovaniemi', 'Rovaniemi', '2026-06-24T10:00:00Z', '2026-06-25T12:00:00Z', 12, NOW(), 66.5039, 25.7294);

-- Items for trip-1: Poland
INSERT INTO items (id, trip_id, type, title, location_name, start_time, end_time, item_order, created_at, lat, lng) 
VALUES 
  ('item-14', 'trip-1', 'flight', 'Flug nach Danzig', 'Helsinki', '2026-06-26T08:00:00Z', '2026-06-26T09:00:00Z', 13, NOW(), 60.1699, 24.9384),
  ('item-15', 'trip-1', 'location', 'Danzig Altstadt', 'Danzig', '2026-06-26T10:00:00Z', '2026-06-26T14:00:00Z', 14, NOW(), 54.352, 18.6466),
  ('item-16', 'trip-1', 'location', 'Warschau', 'Warschau', '2026-06-27T10:00:00Z', '2026-06-28T12:00:00Z', 15, NOW(), 52.2297, 21.0122),
  ('item-17', 'trip-1', 'train', 'Rückfahrt nach Berlin', 'Warschau', '2026-07-01T10:00:00Z', '2026-07-01T18:00:00Z', 16, NOW(), 52.2297, 21.0122, 52.52, 13.405),
  ('item-18', 'trip-1', 'location', 'Zurück in München', 'München', '2026-07-02T10:00:00Z', '2026-07-02T12:00:00Z', 17, NOW(), 48.1351, 11.582);

-- Todos for trip-1
INSERT INTO todos (id, trip_id, text, completed, todo_order, created_at) 
VALUES 
  ('todo-1', 'trip-1', 'Mietwagen in Malmö buchen', false, 0, NOW()),
  ('todo-2', 'trip-1', 'Fähre Malmö buchen', true, 1, NOW()),
  ('todo-3', 'trip-1', 'Hotel Helsinki buchen', false, 2, NOW()),
  ('todo-4', 'trip-1', 'Reisepass verlängern', false, 3, NOW()),
  ('todo-5', 'trip-1', 'Schweden Kronen wechseln', false, 4, NOW()),
  ('todo-6', 'trip-1', 'Wetter in Helsinki prüfen', false, 5, NOW());