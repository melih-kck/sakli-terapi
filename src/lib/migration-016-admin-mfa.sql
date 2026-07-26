-- ==========================================
-- SAKLI TERAPI - Migration 016: Admin MFA enforcement
-- ==========================================
-- Run this after Migration 015. Every policy and trigger that calls
-- private.is_admin_user() will require an AAL2 JWT in addition to the admin role.

BEGIN;

CREATE OR REPLACE FUNCTION private.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE((SELECT auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION private.is_admin_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin_user() TO authenticated;

COMMIT;
