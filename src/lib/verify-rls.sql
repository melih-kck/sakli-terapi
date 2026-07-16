-- Read-only verification for Migrations 009-015.
-- Run in Supabase SQL Editor after applying the migrations.

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = ANY (
    ARRAY[
      'profiles',
      'psychologists',
      'sessions',
      'client_profiles',
      'mood_entries',
      'reviews',
      'notifications',
      'admin_audit_log',
      'notification_preferences',
      'email_notification_outbox'
    ]
  )
ORDER BY c.relname;

SELECT
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = ANY (
    ARRAY[
      'profiles',
      'psychologists',
      'sessions',
      'client_profiles',
      'mood_entries',
      'reviews',
      'notifications',
      'admin_audit_log',
      'notification_preferences',
      'email_notification_outbox'
    ]
  )
ORDER BY tablename, policyname;

SELECT
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('public_psychologists', 'public_reviews')
ORDER BY table_name, ordinal_position;

SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'psychologists',
    'sessions',
    'client_profiles',
    'mood_entries',
    'reviews',
    'notifications',
    'admin_audit_log',
    'notification_preferences',
    'email_notification_outbox',
    'public_psychologists',
    'public_reviews'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT
  has_function_privilege(
    'anon',
    'public.is_admin_user()',
    'EXECUTE'
  ) AS anon_can_call_public_admin_helper,
  has_function_privilege(
    'authenticated',
    'private.is_admin_user()',
    'EXECUTE'
  ) AS authenticated_can_use_private_admin_helper,
  has_function_privilege(
    'anon',
    'public.claim_email_notification_batch(integer)',
    'EXECUTE'
  ) AS anon_can_claim_email_queue,
  has_function_privilege(
    'authenticated',
    'public.claim_email_notification_batch(integer)',
    'EXECUTE'
  ) AS authenticated_can_claim_email_queue,
  has_function_privilege(
    'service_role',
    'public.claim_email_notification_batch(integer)',
    'EXECUTE'
  ) AS service_role_can_claim_email_queue,
  has_function_privilege(
    'authenticated',
    'public.get_session_room_access(uuid)',
    'EXECUTE'
  ) AS authenticated_can_request_session_room,
  has_function_privilege(
    'anon',
    'public.get_session_room_access(uuid)',
    'EXECUTE'
  ) AS anon_can_request_session_room,
  has_column_privilege(
    'authenticated',
    'public.sessions',
    'peer_room_token',
    'SELECT'
  ) AS authenticated_can_read_legacy_room_token,
  has_column_privilege(
    'authenticated',
    'public.sessions',
    'client_peer_token',
    'SELECT'
  ) AS authenticated_can_read_client_peer_token;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (
        ARRAY[
          'profiles',
          'psychologists',
          'sessions',
          'client_profiles',
          'mood_entries',
          'reviews',
          'notifications',
          'admin_audit_log',
          'notification_preferences',
          'email_notification_outbox',
          'psychologist_verification_documents'
        ]
      )
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is disabled on one or more public application tables';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_reviews'
      AND column_name IN ('client_id', 'session_id')
  ) THEN
    RAISE EXCEPTION 'public_reviews exposes a private identifier';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_psychologists'
      AND column_name IN ('document_url', 'approval_status')
  ) THEN
    RAISE EXCEPTION 'public_psychologists exposes an application-only field';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.is_admin_user()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute the public admin helper';
  END IF;

  IF has_table_privilege('anon', 'public.notifications', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read notifications';
  END IF;

  IF has_table_privilege('authenticated', 'public.admin_audit_log', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated users can insert admin audit rows';
  END IF;

  IF has_table_privilege('anon', 'public.notification_preferences', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read notification preferences';
  END IF;

  IF has_table_privilege('authenticated', 'public.notification_preferences', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated users can create notification preference rows';
  END IF;

  IF has_table_privilege('anon', 'public.email_notification_outbox', 'SELECT')
     OR has_table_privilege('authenticated', 'public.email_notification_outbox', 'SELECT') THEN
    RAISE EXCEPTION 'browser roles can read the email delivery queue';
  END IF;

  IF has_table_privilege(
    'anon',
    'public.psychologist_verification_documents',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'anon can read psychologist verification documents';
  END IF;

  IF has_table_privilege(
    'authenticated',
    'public.psychologist_verification_documents',
    'UPDATE'
  ) THEN
    RAISE EXCEPTION 'authenticated has unrestricted document update access';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'psychologist-documents'
      AND public
  ) THEN
    RAISE EXCEPTION 'psychologist document bucket is public';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.claim_email_notification_batch(integer)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.claim_email_notification_batch(integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'browser roles can claim the email delivery queue';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.claim_email_notification_batch(integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role cannot claim the email delivery queue';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.get_session_room_access(uuid)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'public.get_session_room_access(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'session room access function privileges are invalid';
  END IF;

  IF has_column_privilege(
    'authenticated',
    'public.sessions',
    'peer_room_token',
    'SELECT'
  ) OR has_column_privilege(
    'authenticated',
    'public.sessions',
    'client_peer_token',
    'SELECT'
  ) OR has_column_privilege(
    'authenticated',
    'public.sessions',
    'psychologist_peer_token',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'ordinary session reads expose room credentials';
  END IF;
END $$;
