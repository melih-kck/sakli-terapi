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

-- This must run after `on_auth_user_created_profile` (migration-008), which
-- copies the same signup metadata into profiles/psychologists/client_profiles
-- before it is scrubbed here. PostgreSQL fires same-event triggers on a table
-- in alphabetical order by trigger name, and 'on_auth_user_created_profile'
-- sorts before 'on_auth_user_created_scrub_metadata', so the ordering holds
-- today -- but it is implicit. Do not rename either trigger without
-- re-checking this ordering; a scrub-before-copy would silently leave new
-- signups with blank name/topics/emergency-contact/etc. fields.
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
