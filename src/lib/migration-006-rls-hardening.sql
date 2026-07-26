-- ==========================================
-- SAKLI TERAPI - Migration 006: RLS hardening
-- ==========================================
-- Run this after the complete setup if your database was already created.
-- It does not delete table data.

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_profile_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = required_role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_psychologist_approval_status()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT approval_status
  FROM public.psychologists
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_profile_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_psychologist_approval_status() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psychologists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "psychologists_insert_own" ON public.psychologists;
DROP POLICY IF EXISTS "psychologists_update_own" ON public.psychologists;
DROP POLICY IF EXISTS "sessions_insert_client" ON public.sessions;

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role IN ('client', 'psychologist')
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.current_profile_role()
  );

CREATE POLICY "psychologists_insert_own"
  ON public.psychologists FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND public.has_profile_role('psychologist')
    AND COALESCE(approval_status, 'pending') = 'pending'
  );

CREATE POLICY "psychologists_update_own"
  ON public.psychologists FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND approval_status = public.current_psychologist_approval_status()
  );

CREATE POLICY "sessions_insert_client"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    AND status = 'upcoming'
    AND payment_status = 'pending'
    AND reviewed = false
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE status <> 'cancelled'
    GROUP BY psychologist_id, scheduled_date, scheduled_time
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Skipped unique active session slot index because duplicate active slots exist in public.sessions.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_unique_active_slot
      ON public.sessions(psychologist_id, scheduled_date, scheduled_time)
      WHERE status <> 'cancelled';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_entries_unique_client_date
  ON public.mood_entries(client_id, date);
