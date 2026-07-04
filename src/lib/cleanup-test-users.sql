-- ==========================================
-- GIZLIBIRIZ - Cleanup known Codex test users
-- ==========================================
-- Run only after you are done testing.
-- This version deletes public table references first, then auth.users.

DO $$
DECLARE
  test_emails text[] := ARRAY[
    'codex.admin.test.20260604010728@example.com',
    'codex.psych.20260604012300@example.com',
    'codex.client.e2e.20260604014809@example.com',
    'codex.rls7.20260604015131@example.com',
    'codex.regression.20260604015701@example.com'
  ];
BEGIN
  DELETE FROM public.reviews r
  USING public.sessions s
  WHERE r.session_id = s.id
    AND (
      s.client_id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails))
      OR s.psychologist_id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails))
    );

  DELETE FROM public.reviews
  WHERE client_id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails))
     OR psychologist_id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails));

  DELETE FROM public.sessions
  WHERE client_id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails))
     OR psychologist_id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails));

  DELETE FROM public.mood_entries
  WHERE client_id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails));

  DELETE FROM public.client_profiles
  WHERE id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails));

  DELETE FROM public.psychologists
  WHERE id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails));

  DELETE FROM public.profiles
  WHERE id IN (SELECT id FROM auth.users WHERE email = ANY(test_emails));

  DELETE FROM auth.users
  WHERE email = ANY(test_emails);
END $$;

-- Optional check:
-- SELECT email FROM auth.users WHERE email LIKE 'codex.%@example.com';
