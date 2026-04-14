-- Soft delete: Reisen bleiben in der DB, sind in der App nur unsichtbar (deleted_at gesetzt).

ALTER TABLE trips ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_trips_deleted_at ON trips (deleted_at);

COMMENT ON COLUMN trips.deleted_at IS 'Zeitpunkt der Entfernung aus der Liste; NULL = aktiv sichtbar.';

-- Nur aktive (nicht gelöschte) Reisen für die App sichtbar
DROP POLICY IF EXISTS "Users can view trips they collaborate on" ON trips;
CREATE POLICY "Users can view trips they collaborate on" ON trips
  FOR SELECT USING (
    deleted_at IS NULL
    AND (owner_id = auth.uid()::text OR auth.uid()::text = ANY(collaborator_ids))
  );

-- Kein DELETE mehr für normale Nutzer (nur Service Role / Dashboard Recovery)
DROP POLICY IF EXISTS "Users can delete their trips" ON trips;

-- Kinder nur solange die Reise aktiv ist
DROP POLICY IF EXISTS "Users can view items from their trips" ON items;
CREATE POLICY "Users can view items from their trips" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = items.trip_id
      AND t.deleted_at IS NULL
      AND (t.owner_id = auth.uid()::text OR auth.uid()::text = ANY(t.collaborator_ids))
    )
  );

DROP POLICY IF EXISTS "Users can insert items to their trips" ON items;
CREATE POLICY "Users can insert items to their trips" ON items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = items.trip_id
      AND t.deleted_at IS NULL
      AND (t.owner_id = auth.uid()::text OR auth.uid()::text = ANY(t.collaborator_ids))
    )
  );

DROP POLICY IF EXISTS "Users can update items from their trips" ON items;
CREATE POLICY "Users can update items from their trips" ON items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = items.trip_id
      AND t.deleted_at IS NULL
      AND (t.owner_id = auth.uid()::text OR auth.uid()::text = ANY(t.collaborator_ids))
    )
  );

DROP POLICY IF EXISTS "Users can delete items from their trips" ON items;
CREATE POLICY "Users can delete items from their trips" ON items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = items.trip_id
      AND t.deleted_at IS NULL
      AND (t.owner_id = auth.uid()::text OR auth.uid()::text = ANY(t.collaborator_ids))
    )
  );

DROP POLICY IF EXISTS "Users can view todos from their trips" ON todos;
CREATE POLICY "Users can view todos from their trips" ON todos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = todos.trip_id
      AND t.deleted_at IS NULL
      AND (t.owner_id = auth.uid()::text OR auth.uid()::text = ANY(t.collaborator_ids))
    )
  );

DROP POLICY IF EXISTS "Users can insert todos to their trips" ON todos;
CREATE POLICY "Users can insert todos to their trips" ON todos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = todos.trip_id
      AND t.deleted_at IS NULL
      AND (t.owner_id = auth.uid()::text OR auth.uid()::text = ANY(t.collaborator_ids))
    )
  );

DROP POLICY IF EXISTS "Users can update todos from their trips" ON todos;
CREATE POLICY "Users can update todos from their trips" ON todos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = todos.trip_id
      AND t.deleted_at IS NULL
      AND (t.owner_id = auth.uid()::text OR auth.uid()::text = ANY(t.collaborator_ids))
    )
  );

DROP POLICY IF EXISTS "Users can delete todos from their trips" ON todos;
CREATE POLICY "Users can delete todos from their trips" ON todos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = todos.trip_id
      AND t.deleted_at IS NULL
      AND (t.owner_id = auth.uid()::text OR auth.uid()::text = ANY(t.collaborator_ids))
    )
  );
