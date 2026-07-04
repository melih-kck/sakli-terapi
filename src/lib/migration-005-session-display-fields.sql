-- ==========================================
-- GIZLIBIRIZ - Migration 005: Session display fields
-- ==========================================
-- Existing session rows are preserved. This only adds missing columns used by
-- the React dashboards and review flow.

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS client_alias TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS psychologist_name TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS psychologist_initials TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS fee INTEGER;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
