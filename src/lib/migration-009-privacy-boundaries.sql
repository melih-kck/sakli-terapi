-- ==========================================
-- GIZLIBIRIZ - Migration 009: Privacy boundaries
-- ==========================================
-- Run this after Migration 008.
-- It replaces permissive legacy policies with a canonical least-privilege set,
-- exposes only safe public projections, and protects server-managed fields.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION private.has_profile_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = required_role
  );
$$;

CREATE OR REPLACE FUNCTION private.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.current_psychologist_approval_status()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT approval_status
  FROM public.psychologists
  WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.is_approved_psychologist(
  target_psychologist_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.psychologists
    WHERE id = target_psychologist_id
      AND approval_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_profile_role(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_profile_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_psychologist_approval_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_approved_psychologist(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_profile_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_psychologist_approval_status() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_approved_psychologist(uuid) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psychologists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- PostgreSQL combines permissive policies with OR. Remove every legacy policy
-- before recreating the canonical set.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (
        ARRAY[
          'profiles',
          'psychologists',
          'sessions',
          'client_profiles',
          'mood_entries',
          'reviews'
        ]
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  END LOOP;
END $$;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT private.is_admin_user()));

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role IN ('client', 'psychologist')
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = (SELECT private.current_profile_role())
  );

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_admin_user()))
  WITH CHECK ((SELECT private.is_admin_user()));

CREATE POLICY "psychologists_select_own"
  ON public.psychologists FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "psychologists_select_admin"
  ON public.psychologists FOR SELECT
  TO authenticated
  USING ((SELECT private.is_admin_user()));

CREATE POLICY "psychologists_insert_own"
  ON public.psychologists FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND (SELECT private.has_profile_role('psychologist'))
    AND COALESCE(approval_status, 'pending') = 'pending'
  );

CREATE POLICY "psychologists_update_own"
  ON public.psychologists FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND approval_status = (
      SELECT private.current_psychologist_approval_status()
    )
  );

CREATE POLICY "psychologists_update_admin"
  ON public.psychologists FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_admin_user()))
  WITH CHECK ((SELECT private.is_admin_user()));

CREATE POLICY "sessions_select_participants"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = client_id
    OR (SELECT auth.uid()) = psychologist_id
  );

CREATE POLICY "sessions_insert_client"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = client_id
    AND (SELECT private.has_profile_role('client'))
    AND status = 'upcoming'
    AND payment_status = 'pending'
    AND reviewed = false
    AND (SELECT private.is_approved_psychologist(psychologist_id))
  );

CREATE POLICY "sessions_update_participants"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = client_id
    OR (SELECT auth.uid()) = psychologist_id
  )
  WITH CHECK (
    (SELECT auth.uid()) = client_id
    OR (SELECT auth.uid()) = psychologist_id
  );

CREATE POLICY "client_profiles_select_own"
  ON public.client_profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "client_profiles_select_admin"
  ON public.client_profiles FOR SELECT
  TO authenticated
  USING ((SELECT private.is_admin_user()));

CREATE POLICY "client_profiles_insert_own"
  ON public.client_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND (SELECT private.has_profile_role('client'))
  );

CREATE POLICY "client_profiles_update_own"
  ON public.client_profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "mood_entries_select_own"
  ON public.mood_entries FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = client_id);

CREATE POLICY "mood_entries_insert_own"
  ON public.mood_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = client_id
    AND (SELECT private.has_profile_role('client'))
  );

CREATE POLICY "mood_entries_update_own"
  ON public.mood_entries FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = client_id)
  WITH CHECK ((SELECT auth.uid()) = client_id);

CREATE POLICY "reviews_select_own"
  ON public.reviews FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = client_id);

CREATE POLICY "reviews_select_admin"
  ON public.reviews FOR SELECT
  TO authenticated
  USING ((SELECT private.is_admin_user()));

CREATE POLICY "reviews_insert_client_completed_session"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = client_id
    AND (SELECT private.has_profile_role('client'))
    AND EXISTS (
      SELECT 1
      FROM public.sessions
      WHERE sessions.id = session_id
        AND sessions.client_id = (SELECT auth.uid())
        AND sessions.psychologist_id = psychologist_id
        AND sessions.status = 'completed'
        AND sessions.payment_status = 'paid'
        AND sessions.reviewed = false
        AND sessions.channel = reviews.channel
    )
  );

-- Public access goes through views below. Base tables remain private.
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.psychologists FROM anon;
REVOKE ALL ON TABLE public.sessions FROM anon;
REVOKE ALL ON TABLE public.client_profiles FROM anon;
REVOKE ALL ON TABLE public.mood_entries FROM anon;
REVOKE ALL ON TABLE public.reviews FROM anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.psychologists TO authenticated;
GRANT SELECT, INSERT ON TABLE public.sessions TO authenticated;
REVOKE UPDATE ON TABLE public.sessions FROM authenticated;
GRANT UPDATE (status, completed_at, cancellation_reason)
  ON TABLE public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.mood_entries TO authenticated;
GRANT SELECT, INSERT ON TABLE public.reviews TO authenticated;
REVOKE UPDATE, DELETE ON TABLE public.reviews FROM authenticated;

DROP VIEW IF EXISTS public.public_psychologists;
CREATE VIEW public.public_psychologists
WITH (security_barrier = true)
AS
SELECT
  id,
  display_name,
  avatar_initials,
  title,
  bio,
  short_bio,
  experience,
  rating,
  review_count,
  session_count,
  is_candidate,
  base_price,
  specializations,
  approaches,
  channels,
  availability,
  languages,
  university,
  created_at
FROM public.psychologists
WHERE approval_status = 'approved';

REVOKE ALL ON TABLE public.public_psychologists
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_psychologists TO anon, authenticated;

DROP VIEW IF EXISTS public.public_reviews;
CREATE VIEW public.public_reviews
WITH (security_barrier = true)
AS
SELECT
  reviews.id,
  reviews.psychologist_id,
  reviews.rating,
  reviews.categories,
  reviews.comment,
  reviews.anonymous,
  reviews.channel,
  reviews.created_at,
  CASE
    WHEN reviews.anonymous THEN 'Anonim Danisan'
    ELSE COALESCE(reviews.client_alias, 'Anonim Danisan')
  END AS client_alias
FROM public.reviews
WHERE EXISTS (
  SELECT 1
  FROM public.psychologists
  WHERE psychologists.id = reviews.psychologist_id
    AND psychologists.approval_status = 'approved'
);

REVOKE ALL ON TABLE public.public_reviews
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_reviews TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_psychologist_managed_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF (SELECT auth.uid()) IS NOT NULL
     AND NOT (SELECT private.is_admin_user()) THEN
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.rating IS DISTINCT FROM OLD.rating
       OR NEW.review_count IS DISTINCT FROM OLD.review_count
       OR NEW.session_count IS DISTINCT FROM OLD.session_count
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'server-managed psychologist fields cannot be changed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_psychologist_managed_fields()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_enforce_psychologist_managed_fields
  ON public.psychologists;
CREATE TRIGGER trigger_enforce_psychologist_managed_fields
BEFORE UPDATE ON public.psychologists
FOR EACH ROW
EXECUTE FUNCTION private.enforce_psychologist_managed_fields();

CREATE OR REPLACE FUNCTION private.enforce_session_participant_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  -- Service-role operations have no end-user auth.uid() and remain available
  -- for trusted payment callbacks and maintenance tasks.
  IF actor_id IS NULL OR (SELECT private.is_admin_user()) THEN
    RETURN NEW;
  END IF;

  IF actor_id <> OLD.client_id AND actor_id <> OLD.psychologist_id THEN
    RAISE EXCEPTION 'only session participants can update a session';
  END IF;

  IF OLD.status IN ('completed', 'cancelled')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'a closed session cannot be reopened';
  END IF;

  IF NEW.status = 'completed' THEN
    IF OLD.payment_status <> 'paid' THEN
      RAISE EXCEPTION 'an unpaid session cannot be completed';
    END IF;
    NEW.completed_at := COALESCE(OLD.completed_at, NOW());
    NEW.cancellation_reason := NULL;
  ELSIF NEW.status = 'cancelled' THEN
    NEW.completed_at := OLD.completed_at;
    NEW.cancellation_reason := LEFT(
      NULLIF(TRIM(NEW.cancellation_reason), ''),
      500
    );
  ELSE
    NEW.completed_at := NULL;
    NEW.cancellation_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_session_participant_update()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_enforce_session_participant_update
  ON public.sessions;
CREATE TRIGGER trigger_enforce_session_participant_update
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION private.enforce_session_participant_update();

CREATE OR REPLACE FUNCTION private.update_psychologist_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_psychologist_id uuid;
BEGIN
  target_psychologist_id := COALESCE(
    NEW.psychologist_id,
    OLD.psychologist_id
  );

  UPDATE public.psychologists
  SET
    rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)
      FROM public.reviews
      WHERE psychologist_id = target_psychologist_id
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE psychologist_id = target_psychologist_id
    )
  WHERE id = target_psychologist_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION private.update_psychologist_rating()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_update_rating ON public.reviews;
CREATE TRIGGER trigger_update_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION private.update_psychologist_rating();

-- Existing public helper functions are no longer used by RLS. Keep trigger
-- helpers operational but prevent direct API execution.
REVOKE ALL ON FUNCTION public.is_admin_user()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_profile_role(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_profile_role()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_psychologist_approval_status()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_psychologist_rating()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_session_reviewed_from_review()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_auth_user_profile()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jsonb_text_array(jsonb, text[])
  FROM PUBLIC, anon, authenticated;
