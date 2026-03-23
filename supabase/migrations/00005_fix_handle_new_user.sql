-- Fix handle_new_user trigger:
-- 1. Make email nullable (some auth providers don't set it immediately)
-- 2. Use COALESCE for safety
-- 3. Add exception handler so auth signup never fails due to our trigger

ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.users.email),
    name = CASE WHEN public.users.name = '' THEN COALESCE(EXCLUDED.name, '') ELSE public.users.name END;

  INSERT INTO public.style_profiles (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.happiness_weights (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
