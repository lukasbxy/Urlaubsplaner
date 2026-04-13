-- Re-enable RLS for production (data only for authenticated owners/collaborators)
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trips they collaborate on" ON trips
  FOR SELECT USING (owner_id = auth.uid()::text OR auth.uid()::text = ANY(collaborator_ids));

CREATE POLICY "Users can insert trips they create" ON trips
  FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update their trips" ON trips
  FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can delete their trips" ON trips
  FOR DELETE USING (owner_id = auth.uid()::text);

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
