-- ==========================================
-- GIZLIBIRIZ - Session insert hardening
-- Migration 011
-- ==========================================
-- Run this after Migration 010. Client applications choose only the
-- psychologist, schedule, and communication channel. Identity, price,
-- workflow state, and room credentials are derived by the database.

BEGIN;

ALTER FUNCTION public.handle_auth_user_profile() SET search_path = '';
ALTER FUNCTION public.mark_session_reviewed_from_review() SET search_path = '';
ALTER FUNCTION public.jsonb_text_array(jsonb, text[]) SET search_path = '';

CREATE OR REPLACE FUNCTION private.prepare_session_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  actor_alias text;
  target_name text;
  target_initials text;
  target_base_price integer;
  target_channels text[];
BEGIN
  -- Trusted service-role maintenance has no end-user auth.uid().
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (SELECT private.has_profile_role('client')) THEN
    RAISE EXCEPTION 'only client accounts can create sessions'
      USING ERRCODE = '42501';
  END IF;

  SELECT profiles.alias
  INTO actor_alias
  FROM public.profiles AS profiles
  WHERE profiles.id = actor_id;

  SELECT
    psychologists.display_name,
    psychologists.avatar_initials,
    psychologists.base_price,
    psychologists.channels
  INTO
    target_name,
    target_initials,
    target_base_price,
    target_channels
  FROM public.psychologists AS psychologists
  WHERE psychologists.id = NEW.psychologist_id
    AND psychologists.approval_status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approved psychologist not found'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.channel IS NULL
     OR NOT (NEW.channel = ANY(COALESCE(target_channels, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'selected communication channel is unavailable'
      USING ERRCODE = '22023';
  END IF;

  NEW.client_id := actor_id;
  NEW.client_alias := COALESCE(NULLIF(TRIM(actor_alias), ''), 'Anonim Danisan');
  NEW.psychologist_name := COALESCE(NULLIF(TRIM(target_name), ''), 'Psikolog');
  NEW.psychologist_initials := COALESCE(NULLIF(TRIM(target_initials), ''), 'P');
  NEW.fee := GREATEST(COALESCE(target_base_price, 0), 0);
  NEW.status := 'upcoming';
  NEW.payment_status := 'pending';
  NEW.reviewed := false;
  NEW.paid_at := NULL;
  NEW.completed_at := NULL;
  NEW.cancellation_reason := NULL;
  NEW.peer_room_token := pg_catalog.gen_random_uuid();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_session_insert()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_prepare_session_insert
  ON public.sessions;
CREATE TRIGGER trigger_prepare_session_insert
BEFORE INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION private.prepare_session_insert();

CREATE OR REPLACE FUNCTION private.prepare_review_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  session_alias text;
  session_psychologist_id uuid;
  session_channel text;
  category_listening numeric;
  category_empathy numeric;
  category_clarity numeric;
  category_trust numeric;
BEGIN
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (SELECT private.has_profile_role('client')) THEN
    RAISE EXCEPTION 'only client accounts can create reviews'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    sessions.client_alias,
    sessions.psychologist_id,
    sessions.channel
  INTO
    session_alias,
    session_psychologist_id,
    session_channel
  FROM public.sessions AS sessions
  WHERE sessions.id = NEW.session_id
    AND sessions.client_id = actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reviewable session not found'
      USING ERRCODE = '23503';
  END IF;

  BEGIN
    category_listening := COALESCE(NULLIF(NEW.categories->>'listening', '')::numeric, NEW.rating);
    category_empathy := COALESCE(NULLIF(NEW.categories->>'empathy', '')::numeric, NEW.rating);
    category_clarity := COALESCE(NULLIF(NEW.categories->>'clarity', '')::numeric, NEW.rating);
    category_trust := COALESCE(NULLIF(NEW.categories->>'trust', '')::numeric, NEW.rating);
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'review category ratings must be numeric'
        USING ERRCODE = '22023';
  END;

  IF category_listening NOT BETWEEN 1 AND 5
     OR category_empathy NOT BETWEEN 1 AND 5
     OR category_clarity NOT BETWEEN 1 AND 5
     OR category_trust NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'review category ratings must be between 1 and 5'
      USING ERRCODE = '22023';
  END IF;

  NEW.client_id := actor_id;
  NEW.psychologist_id := session_psychologist_id;
  NEW.channel := session_channel;
  NEW.anonymous := COALESCE(NEW.anonymous, true);
  NEW.client_alias := CASE
    WHEN NEW.anonymous THEN 'Anonim Danisan'
    ELSE COALESCE(NULLIF(TRIM(session_alias), ''), 'Anonim Danisan')
  END;
  NEW.rating := ROUND((
    category_listening
    + category_empathy
    + category_clarity
    + category_trust
  ) / 4, 2);
  NEW.categories := jsonb_build_object(
    'listening', category_listening,
    'empathy', category_empathy,
    'clarity', category_clarity,
    'trust', category_trust,
    'communication', category_clarity,
    'professionalism', category_trust
  );
  NEW.comment := LEFT(TRIM(COALESCE(NEW.comment, '')), 2000);

  IF LENGTH(NEW.comment) < 10 THEN
    RAISE EXCEPTION 'review comment must contain at least 10 characters'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_review_insert()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_prepare_review_insert
  ON public.reviews;
CREATE TRIGGER trigger_prepare_review_insert
BEFORE INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION private.prepare_review_insert();

-- Supervisor details are application-review data, not public catalog data.
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

COMMIT;
