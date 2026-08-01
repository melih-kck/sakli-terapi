BEGIN;

-- Onboarding metadata is needed only while the profile trigger copies it into
-- RLS-protected application tables. Remove it from Auth afterwards so private
-- profile fields are not repeated in JWT user_metadata claims.
CREATE OR REPLACE FUNCTION private.scrub_auth_onboarding_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users AS users
  SET raw_user_meta_data = COALESCE(users.raw_user_meta_data, '{}'::jsonb) - ARRAY[
    'role',
    'alias',
    'name',
    'privacyLevel',
    'topics',
    'preferredChannel',
    'emergencyName',
    'emergencyPhone',
    'city',
    'title',
    'shortBio',
    'bio',
    'experience',
    'isCandidate',
    'basePrice',
    'specializations',
    'approaches',
    'channels',
    'university',
    'supervisorName'
  ]::text[]
  WHERE users.id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.scrub_auth_onboarding_metadata()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_scrub_metadata ON auth.users;
CREATE TRIGGER on_auth_user_created_scrub_metadata
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.scrub_auth_onboarding_metadata();

-- Remove the same transient fields from accounts created before this migration.
UPDATE auth.users AS users
SET raw_user_meta_data = COALESCE(users.raw_user_meta_data, '{}'::jsonb) - ARRAY[
  'role',
  'alias',
  'name',
  'privacyLevel',
  'topics',
  'preferredChannel',
  'emergencyName',
  'emergencyPhone',
  'city',
  'title',
  'shortBio',
  'bio',
  'experience',
  'isCandidate',
  'basePrice',
  'specializations',
  'approaches',
  'channels',
  'university',
  'supervisorName'
]::text[]
WHERE COALESCE(users.raw_user_meta_data, '{}'::jsonb) ?| ARRAY[
  'role',
  'alias',
  'name',
  'privacyLevel',
  'topics',
  'preferredChannel',
  'emergencyName',
  'emergencyPhone',
  'city',
  'title',
  'shortBio',
  'bio',
  'experience',
  'isCandidate',
  'basePrice',
  'specializations',
  'approaches',
  'channels',
  'university',
  'supervisorName'
]::text[];

COMMIT;
