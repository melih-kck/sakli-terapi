-- ==========================================
-- GIZLIBIRIZ - Session room access hardening
-- Migration 014
-- ==========================================
-- Run this after Migration 013. Payments remain intentionally disabled:
-- payment_required=false means that a pending payment does not block a session.
-- Room credentials are exposed only through a time-limited participant RPC.

BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS payment_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_peer_token uuid DEFAULT pg_catalog.gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS psychologist_peer_token uuid DEFAULT pg_catalog.gen_random_uuid();

UPDATE public.sessions
SET
  payment_required = COALESCE(payment_required, false),
  client_peer_token = COALESCE(client_peer_token, pg_catalog.gen_random_uuid()),
  psychologist_peer_token = COALESCE(psychologist_peer_token, pg_catalog.gen_random_uuid());

ALTER TABLE public.sessions
  ALTER COLUMN payment_required SET DEFAULT false,
  ALTER COLUMN payment_required SET NOT NULL,
  ALTER COLUMN client_peer_token SET DEFAULT pg_catalog.gen_random_uuid(),
  ALTER COLUMN client_peer_token SET NOT NULL,
  ALTER COLUMN psychologist_peer_token SET DEFAULT pg_catalog.gen_random_uuid(),
  ALTER COLUMN psychologist_peer_token SET NOT NULL;

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
  NEW.payment_required := false;
  NEW.reviewed := false;
  NEW.paid_at := NULL;
  NEW.completed_at := NULL;
  NEW.cancellation_reason := NULL;
  NEW.peer_room_token := pg_catalog.gen_random_uuid();
  NEW.client_peer_token := pg_catalog.gen_random_uuid();
  NEW.psychologist_peer_token := pg_catalog.gen_random_uuid();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_session_insert()
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "sessions_insert_client" ON public.sessions;
CREATE POLICY "sessions_insert_client"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = client_id
    AND (SELECT private.has_profile_role('client'))
    AND status = 'upcoming'
    AND payment_status = 'pending'
    AND payment_required = false
    AND reviewed = false
    AND scheduled_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    AND (
      scheduled_date + scheduled_time::time
      > timezone('Europe/Istanbul', now())
    )
    AND (SELECT private.is_approved_psychologist(psychologist_id))
  );

CREATE OR REPLACE FUNCTION private.enforce_session_participant_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  scheduled_start timestamp without time zone;
BEGIN
  -- Service-role and administrators remain available for trusted maintenance.
  IF actor_id IS NULL OR (SELECT private.is_admin_user()) THEN
    RETURN NEW;
  END IF;

  IF actor_id <> OLD.client_id AND actor_id <> OLD.psychologist_id THEN
    RAISE EXCEPTION 'only session participants can update a session'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status IN ('completed', 'cancelled')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'a closed session cannot be reopened'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF actor_id = OLD.client_id AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'clients can only cancel an upcoming session'
        USING ERRCODE = '42501';
    END IF;

    IF actor_id = OLD.psychologist_id
       AND NEW.status NOT IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'psychologists can only complete or cancel an upcoming session'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status = 'completed' THEN
    IF actor_id <> OLD.psychologist_id THEN
      RAISE EXCEPTION 'only the psychologist can complete a session'
        USING ERRCODE = '42501';
    END IF;

    scheduled_start := OLD.scheduled_date + OLD.scheduled_time::time;
    IF scheduled_start > timezone('Europe/Istanbul', now()) THEN
      RAISE EXCEPTION 'a session cannot be completed before its scheduled start'
        USING ERRCODE = '22023';
    END IF;

    IF OLD.payment_required AND OLD.payment_status <> 'paid' THEN
      RAISE EXCEPTION 'a session requiring payment cannot be completed before payment'
        USING ERRCODE = '22023';
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

DROP POLICY IF EXISTS "reviews_insert_client_completed_session" ON public.reviews;
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
        AND (
          NOT sessions.payment_required
          OR sessions.payment_status = 'paid'
        )
        AND sessions.reviewed = false
        AND sessions.channel = reviews.channel
    )
  );

-- Remove room credentials from ordinary participant reads. RLS still limits
-- these safe columns to rows belonging to the signed-in participant.
REVOKE SELECT ON TABLE public.sessions FROM authenticated;
GRANT SELECT (
  id,
  client_id,
  psychologist_id,
  scheduled_date,
  scheduled_time,
  channel,
  status,
  payment_status,
  payment_required,
  reviewed,
  fee,
  paid_at,
  completed_at,
  cancellation_reason,
  client_alias,
  psychologist_name,
  psychologist_initials,
  created_at
) ON TABLE public.sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.get_session_room_access(
  target_session_id uuid
)
RETURNS TABLE (
  my_peer_id text,
  target_peer_id text,
  participant_role text,
  session_channel text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication is required for session room access'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN actor_id = sessions.client_id THEN sessions.client_peer_token::text
      ELSE sessions.psychologist_peer_token::text
    END,
    CASE
      WHEN actor_id = sessions.client_id THEN sessions.psychologist_peer_token::text
      ELSE sessions.client_peer_token::text
    END,
    CASE
      WHEN actor_id = sessions.client_id THEN 'client'::text
      ELSE 'psychologist'::text
    END,
    sessions.channel
  FROM public.sessions AS sessions
  WHERE sessions.id = target_session_id
    AND actor_id IN (sessions.client_id, sessions.psychologist_id)
    AND sessions.status = 'upcoming'
    AND (
      NOT sessions.payment_required
      OR sessions.payment_status = 'paid'
    )
    AND sessions.client_peer_token IS NOT NULL
    AND sessions.psychologist_peer_token IS NOT NULL
    AND timezone('Europe/Istanbul', now())
      BETWEEN (
        sessions.scheduled_date + sessions.scheduled_time::time
        - INTERVAL '15 minutes'
      ) AND (
        sessions.scheduled_date + sessions.scheduled_time::time
        + INTERVAL '90 minutes'
      );
END;
$$;

REVOKE ALL ON FUNCTION public.get_session_room_access(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_room_access(uuid)
  TO authenticated;

COMMIT;
