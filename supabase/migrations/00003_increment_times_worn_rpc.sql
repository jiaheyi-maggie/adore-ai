-- Atomic increment for times_worn (avoids read-then-write race condition)
CREATE OR REPLACE FUNCTION increment_times_worn(item_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE wardrobe_items
  SET times_worn = times_worn + 1
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
