-- ==========================================
-- GIZLIBIRIZ - Migration 008: Auth profile trigger
-- ==========================================
-- Run this after Migration 007. It does not delete table data.
-- It creates public profile rows automatically when Supabase Auth creates
-- a user. This keeps registration working when email confirmation is ON.

CREATE OR REPLACE FUNCTION public.jsonb_text_array(value jsonb, fallback text[] DEFAULT '{}'::text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(value) = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(value))
    ELSE fallback
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  requested_role text := COALESCE(metadata->>'role', 'client');
  profile_role text;
  requested_privacy text := metadata->>'privacyLevel';
  profile_privacy integer := 5;
BEGIN
  profile_role := CASE
    WHEN requested_role IN ('client', 'psychologist') THEN requested_role
    ELSE 'client'
  END;

  IF requested_privacy ~ '^[0-9]+$' THEN
    profile_privacy := LEAST(GREATEST(requested_privacy::integer, 1), 5);
  END IF;

  INSERT INTO public.profiles (id, email, role, alias, name, privacy_level)
  VALUES (
    NEW.id,
    NEW.email,
    profile_role,
    NULLIF(metadata->>'alias', ''),
    NULLIF(metadata->>'name', ''),
    profile_privacy
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = CASE
      WHEN public.profiles.role = 'admin' THEN 'admin'
      ELSE EXCLUDED.role
    END,
    alias = COALESCE(public.profiles.alias, EXCLUDED.alias),
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    privacy_level = COALESCE(public.profiles.privacy_level, EXCLUDED.privacy_level);

  IF profile_role = 'client' THEN
    INSERT INTO public.client_profiles (
      id,
      topics,
      preferred_channel,
      emergency_name,
      emergency_phone,
      city,
      privacy_level
    )
    VALUES (
      NEW.id,
      public.jsonb_text_array(metadata->'topics', '{}'::text[]),
      COALESCE(NULLIF(metadata->>'preferredChannel', ''), 'video-blur'),
      NULLIF(metadata->>'emergencyName', ''),
      NULLIF(metadata->>'emergencyPhone', ''),
      NULLIF(metadata->>'city', ''),
      profile_privacy
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF profile_role = 'psychologist' THEN
    INSERT INTO public.psychologists (
      id,
      display_name,
      avatar_initials,
      title,
      bio,
      short_bio,
      experience,
      is_candidate,
      approval_status,
      base_price,
      specializations,
      approaches,
      channels,
      university,
      supervisor
    )
    VALUES (
      NEW.id,
      COALESCE(NULLIF(metadata->>'name', ''), 'GizliBiriz Psikologu'),
      UPPER(LEFT(COALESCE(NULLIF(metadata->>'name', ''), 'GB'), 1)),
      COALESCE(NULLIF(metadata->>'title', ''), 'Psikolog'),
      NULLIF(metadata->>'bio', ''),
      NULLIF(metadata->>'shortBio', ''),
      CASE
        WHEN COALESCE(metadata->>'experience', '') ~ '^[0-9]+$'
          THEN (metadata->>'experience')::integer
        ELSE 0
      END,
      COALESCE((metadata->>'isCandidate')::boolean, false),
      'pending',
      CASE
        WHEN COALESCE(metadata->>'basePrice', '') ~ '^[0-9]+$'
          THEN (metadata->>'basePrice')::integer
        ELSE 1000
      END,
      public.jsonb_text_array(metadata->'specializations', '{}'::text[]),
      public.jsonb_text_array(metadata->'approaches', '{}'::text[]),
      public.jsonb_text_array(metadata->'channels', ARRAY['video-blur', 'voice', 'text']),
      NULLIF(metadata->>'university', ''),
      NULLIF(metadata->>'supervisorName', '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_profile();
