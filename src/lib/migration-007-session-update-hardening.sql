-- ==========================================
-- SAKLI TERAPI - Migration 007: Session update hardening
-- ==========================================
-- Run this after Migration 006. It does not delete table data.
-- It prevents browser-authenticated users from marking real sessions as paid.
-- Payment status should be changed only by the server-side payment callback
-- with a Supabase service role key when payment is implemented.

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_update_participants" ON public.sessions;

CREATE POLICY "sessions_update_participants"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = psychologist_id)
  WITH CHECK (auth.uid() = client_id OR auth.uid() = psychologist_id);

-- Restrict which columns browser-authenticated users can update.
-- Participants may cancel or complete a session, but they cannot alter payment,
-- participant identity, schedule, price, room token, or display fields.
REVOKE UPDATE ON public.sessions FROM anon;
REVOKE UPDATE ON public.sessions FROM authenticated;
GRANT UPDATE (status, completed_at, cancellation_reason)
  ON public.sessions TO authenticated;

-- Reviews should mark their session as reviewed through this trusted trigger,
-- not through a browser-side direct sessions.update({ reviewed: true }).
CREATE OR REPLACE FUNCTION public.mark_session_reviewed_from_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.sessions
  SET reviewed = true
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_mark_session_reviewed ON public.reviews;
CREATE TRIGGER trigger_mark_session_reviewed
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.mark_session_reviewed_from_review();
