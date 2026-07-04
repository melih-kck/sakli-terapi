-- Read-only verification for Migration 009.
-- Run in Supabase SQL Editor after applying the migration.

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
      'reviews'
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
      'reviews'
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
  ) AS authenticated_can_use_private_admin_helper;

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
          'reviews'
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
END $$;
