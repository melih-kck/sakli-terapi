-- ==========================================
-- GIZLIBIRIZ - Booking availability hardening
-- Migration 010
-- ==========================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE status <> 'cancelled'
    GROUP BY psychologist_id, scheduled_date, scheduled_time
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce unique booking slots while duplicate active sessions exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_unique_active_slot
  ON public.sessions(psychologist_id, scheduled_date, scheduled_time)
  WHERE status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.get_booked_slots(
  target_psychologist_id uuid,
  range_start date,
  range_end date
)
RETURNS TABLE (
  scheduled_date date,
  scheduled_time text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    private.has_profile_role('client')
    OR private.is_admin_user()
    OR auth.uid() = target_psychologist_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to inspect booking availability.'
      USING ERRCODE = '42501';
  END IF;

  IF range_start IS NULL
    OR range_end IS NULL
    OR range_end < range_start
    OR range_end - range_start > 31
  THEN
    RAISE EXCEPTION 'Booking availability range must be between 1 and 32 days.'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    sessions.scheduled_date,
    sessions.scheduled_time
  FROM public.sessions AS sessions
  JOIN public.psychologists AS psychologists
    ON psychologists.id = sessions.psychologist_id
  WHERE sessions.psychologist_id = target_psychologist_id
    AND sessions.scheduled_date BETWEEN range_start AND range_end
    AND sessions.status <> 'cancelled'
    AND psychologists.approval_status = 'approved'
  ORDER BY sessions.scheduled_date, sessions.scheduled_time;
END;
$$;

REVOKE ALL ON FUNCTION public.get_booked_slots(uuid, date, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(uuid, date, date)
  TO authenticated;

DROP POLICY IF EXISTS "sessions_insert_client" ON public.sessions;
CREATE POLICY "sessions_insert_client"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = client_id
    AND (SELECT private.has_profile_role('client'))
    AND status = 'upcoming'
    AND payment_status = 'pending'
    AND reviewed = false
    AND scheduled_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    AND (
      scheduled_date + scheduled_time::time
      > timezone('Europe/Istanbul', now())
    )
    AND (SELECT private.is_approved_psychologist(psychologist_id))
  );

COMMIT;
