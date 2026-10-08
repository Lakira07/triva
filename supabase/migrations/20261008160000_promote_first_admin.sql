-- Promotes the first authenticated user to admin when no admin exists.
-- This allows the first person who signs up to become the initial administrator.
CREATE OR REPLACE FUNCTION public.promote_first_user_to_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE is_admin = true
  ) THEN
    UPDATE public.profiles
    SET is_admin = true
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_first_profile_created ON public.profiles;
CREATE TRIGGER on_first_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_first_user_to_admin();
