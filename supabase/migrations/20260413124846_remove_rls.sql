-- Disable RLS for all tables (open access for demo)
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE todos DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view trips they collaborate on" ON trips;
DROP POLICY IF EXISTS "Users can insert trips they create" ON trips;
DROP POLICY IF EXISTS "Users can update their trips" ON trips;
DROP POLICY IF EXISTS "Users can delete their trips" ON trips;
DROP POLICY IF EXISTS "Users can view items from their trips" ON items;
DROP POLICY IF EXISTS "Users can insert items to their trips" ON items;
DROP POLICY IF EXISTS "Users can update items from their trips" ON items;
DROP POLICY IF EXISTS "Users can delete items from their trips" ON items;
DROP POLICY IF EXISTS "Users can view todos from their trips" ON todos;
DROP POLICY IF EXISTS "Users can insert todos to their trips" ON todos;
DROP POLICY IF EXISTS "Users can update todos from their trips" ON todos;
DROP POLICY IF EXISTS "Users can delete todos from their trips" ON todos;