-- Create trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  owner_id TEXT NOT NULL,
  collaborator_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  flight_cost NUMERIC,
  train_cost NUMERIC,
  transport_cost NUMERIC
);

-- Create items table (child of trips)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  is_all_day BOOLEAN DEFAULT FALSE,
  location_name TEXT,
  lat NUMERIC,
  lng NUMERIC,
  end_location_name TEXT,
  end_lat NUMERIC,
  end_lng NUMERIC,
  cost NUMERIC,
  booking_reference TEXT,
  file_data TEXT,
  file_name TEXT,
  item_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create todos table (child of trips)
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  todo_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Trips policies
CREATE POLICY "Users can view trips they collaborate on" ON trips
  FOR SELECT USING (owner_id = auth.uid()::text OR auth.uid()::text = ANY(collaborator_ids));

CREATE POLICY "Users can insert trips they create" ON trips
  FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update their trips" ON trips
  FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can delete their trips" ON trips
  FOR DELETE USING (owner_id = auth.uid()::text);

-- Items policies
CREATE POLICY "Users can view items from their trips" ON items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = items.trip_id AND (trips.owner_id = auth.uid()::text OR auth.uid()::text = ANY(trips.collaborator_ids)))
  );

CREATE POLICY "Users can insert items to their trips" ON items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = items.trip_id AND (trips.owner_id = auth.uid()::text OR auth.uid()::text = ANY(trips.collaborator_ids)))
  );

CREATE POLICY "Users can update items from their trips" ON items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = items.trip_id AND (trips.owner_id = auth.uid()::text OR auth.uid()::text = ANY(trips.collaborator_ids)))
  );

CREATE POLICY "Users can delete items from their trips" ON items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = items.trip_id AND (trips.owner_id = auth.uid()::text OR auth.uid()::text = ANY(trips.collaborator_ids)))
  );

-- Todos policies
CREATE POLICY "Users can view todos from their trips" ON todos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = todos.trip_id AND (trips.owner_id = auth.uid()::text OR auth.uid()::text = ANY(trips.collaborator_ids)))
  );

CREATE POLICY "Users can insert todos to their trips" ON todos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = todos.trip_id AND (trips.owner_id = auth.uid()::text OR auth.uid()::text = ANY(trips.collaborator_ids)))
  );

CREATE POLICY "Users can update todos from their trips" ON todos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = todos.trip_id AND (trips.owner_id = auth.uid()::text OR auth.uid()::text = ANY(trips.collaborator_ids)))
  );

CREATE POLICY "Users can delete todos from their trips" ON todos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = todos.trip_id AND (trips.owner_id = auth.uid()::text OR auth.uid()::text = ANY(trips.collaborator_ids)))
  );

-- Create indexes for better query performance
CREATE INDEX idx_items_trip_id ON items(trip_id);
CREATE INDEX idx_items_order ON items(trip_id, item_order);
CREATE INDEX idx_todos_trip_id ON todos(trip_id);
CREATE INDEX idx_todos_order ON todos(trip_id, todo_order);
CREATE INDEX idx_trips_collaborator ON trips USING GIN (collaborator_ids);