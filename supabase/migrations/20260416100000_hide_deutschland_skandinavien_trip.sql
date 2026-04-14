-- Demo-/Seed-Reise aus der App-Ansicht ausblenden (Soft-Delete)
UPDATE trips
SET deleted_at = NOW()
WHERE title = 'Deutschland & Skandinavien'
  AND deleted_at IS NULL;
