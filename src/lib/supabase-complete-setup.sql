-- ==========================================
-- GIZLIBIRIZ - Supabase complete setup
-- ==========================================
-- Run this file in Supabase SQL Editor instead of running the separate
-- migration-00x files one by one.
--
-- It is designed to be idempotent:
-- - Existing tables and rows are preserved.
-- - Missing columns, indexes, policies, functions, and triggers are added.
-- - Known old policies are replaced with the current canonical policies.
--
-- After this baseline setup, also run migration-009-privacy-boundaries.sql.
-- It is kept separate so the latest privacy boundary remains auditable.
--
-- Important:
-- - This script does not automatically promote any email to admin.
-- - After creating your admin user, run the commented UPDATE near the bottom
--   with your real admin email.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. Profiles
-- ==========================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  alias TEXT,
  name TEXT,
  privacy_level INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alias TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_level INTEGER DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(constraint_row.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('client', 'psychologist', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_privacy_level_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_privacy_level_check
      CHECK (privacy_level BETWEEN 1 AND 5);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_profile_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = required_role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_psychologist_approval_status()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT approval_status
  FROM public.psychologists
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_profile_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_psychologist_approval_status() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_row.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Profilleri herkes görebilir." ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcılar kendi profillerini oluşturabilir." ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcılar kendi profillerini güncelleyebilir." ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcılar kendi profilini görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Adminler profilleri görebilir" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role IN ('client', 'psychologist')
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.current_profile_role()
  );

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ==========================================
-- 2. Psychologists
-- ==========================================

CREATE TABLE IF NOT EXISTS public.psychologists (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_initials TEXT,
  title TEXT,
  bio TEXT,
  short_bio TEXT,
  experience INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  is_candidate BOOLEAN DEFAULT false,
  approval_status TEXT DEFAULT 'pending',
  document_url TEXT,
  base_price INTEGER DEFAULT 1000,
  specializations TEXT[],
  approaches TEXT[],
  channels TEXT[],
  availability JSONB DEFAULT '{}'::jsonb,
  languages TEXT[] DEFAULT ARRAY[U&'T\00FCrk\00E7e'],
  university TEXT,
  supervisor TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS avatar_initials TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS short_bio TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS is_candidate BOOLEAN DEFAULT false;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS base_price INTEGER DEFAULT 1000;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS specializations TEXT[];
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS approaches TEXT[];
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS channels TEXT[];
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY[U&'T\00FCrk\00E7e'];
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS university TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS supervisor TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.psychologists
  ALTER COLUMN rating TYPE NUMERIC(3,2)
  USING rating::numeric(3,2);

UPDATE public.psychologists p
SET
  display_name = COALESCE(p.display_name, pr.name, p.title, U&'Sakl\0131 Terapi Psikolo\011Fu'),
  avatar_initials = COALESCE(
    p.avatar_initials,
    UPPER(LEFT(COALESCE(pr.name, p.title, 'ST'), 1))
  ),
  short_bio = COALESCE(
    p.short_bio,
    LEFT(COALESCE(p.bio, U&'Gizlilik odakl\0131 \00E7evrimi\00E7i psikolojik dan\0131\015Fmanl\0131k.'), 120)
  ),
  channels = COALESCE(p.channels, ARRAY['video-blur', 'voice', 'text']),
  languages = COALESCE(p.languages, ARRAY[U&'T\00FCrk\00E7e']),
  availability = COALESCE(p.availability, '{}'::jsonb),
  approval_status = COALESCE(p.approval_status, 'pending'),
  base_price = COALESCE(p.base_price, 1000),
  review_count = COALESCE(p.review_count, 0),
  session_count = COALESCE(p.session_count, 0)
FROM public.profiles pr
WHERE p.id = pr.id;

UPDATE public.psychologists
SET
  display_name = COALESCE(display_name, title, U&'Sakl\0131 Terapi Psikolo\011Fu'),
  avatar_initials = COALESCE(avatar_initials, 'ST'),
  short_bio = COALESCE(short_bio, LEFT(COALESCE(bio, U&'Gizlilik odakl\0131 \00E7evrimi\00E7i psikolojik dan\0131\015Fmanl\0131k.'), 120)),
  channels = COALESCE(channels, ARRAY['video-blur', 'voice', 'text']),
  languages = COALESCE(languages, ARRAY[U&'T\00FCrk\00E7e']),
  availability = COALESCE(availability, '{}'::jsonb),
  approval_status = COALESCE(approval_status, 'pending'),
  base_price = COALESCE(base_price, 1000),
  review_count = COALESCE(review_count, 0),
  session_count = COALESCE(session_count, 0);

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.psychologists'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%approval_status%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.psychologists DROP CONSTRAINT ' || quote_ident(constraint_row.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.psychologists'::regclass
      AND conname = 'psychologists_approval_status_check'
  ) THEN
    ALTER TABLE public.psychologists
      ADD CONSTRAINT psychologists_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

ALTER TABLE public.psychologists ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'psychologists'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.psychologists', policy_row.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Psikolog profillerini herkes görebilir." ON public.psychologists;
DROP POLICY IF EXISTS "Psikologlar kendi detaylarını güncelleyebilir." ON public.psychologists;
DROP POLICY IF EXISTS "Onaylı psikolog profillerini herkes görebilir" ON public.psychologists;
DROP POLICY IF EXISTS "Psikologlar kendi başvurusunu görebilir" ON public.psychologists;
DROP POLICY IF EXISTS "Psikologlar kendi başvurusunu oluşturabilir" ON public.psychologists;
DROP POLICY IF EXISTS "Psikologlar kendi detaylarını güncelleyebilir" ON public.psychologists;
DROP POLICY IF EXISTS "Adminler psikolog başvurularını yönetebilir" ON public.psychologists;
DROP POLICY IF EXISTS "psychologists_select_approved_public" ON public.psychologists;
DROP POLICY IF EXISTS "psychologists_select_own" ON public.psychologists;
DROP POLICY IF EXISTS "psychologists_insert_own" ON public.psychologists;
DROP POLICY IF EXISTS "psychologists_update_own" ON public.psychologists;
DROP POLICY IF EXISTS "psychologists_admin_all" ON public.psychologists;
DROP POLICY IF EXISTS "psychologists_select_admin" ON public.psychologists;
DROP POLICY IF EXISTS "psychologists_update_admin" ON public.psychologists;

CREATE POLICY "psychologists_select_approved_public"
  ON public.psychologists FOR SELECT
  TO anon, authenticated
  USING (approval_status = 'approved');

CREATE POLICY "psychologists_select_own"
  ON public.psychologists FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "psychologists_select_admin"
  ON public.psychologists FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "psychologists_insert_own"
  ON public.psychologists FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND public.has_profile_role('psychologist')
    AND COALESCE(approval_status, 'pending') = 'pending'
  );

CREATE POLICY "psychologists_update_own"
  ON public.psychologists FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND approval_status = public.current_psychologist_approval_status()
  );

CREATE POLICY "psychologists_update_admin"
  ON public.psychologists FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ==========================================
-- 3. Sessions
-- ==========================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  psychologist_id UUID REFERENCES public.psychologists(id) ON DELETE CASCADE NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'video-blur',
  status TEXT DEFAULT 'upcoming',
  payment_status TEXT DEFAULT 'pending',
  reviewed BOOLEAN DEFAULT false,
  fee INTEGER,
  paid_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  client_alias TEXT,
  psychologist_name TEXT,
  psychologist_initials TEXT,
  peer_room_token UUID DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS psychologist_id UUID REFERENCES public.psychologists(id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'video-blur';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'upcoming';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS fee INTEGER;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS client_alias TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS psychologist_name TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS psychologist_initials TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS peer_room_token UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.sessions'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%channel%'
        OR pg_get_constraintdef(oid) ILIKE '%status%'
        OR pg_get_constraintdef(oid) ILIKE '%payment_status%'
      )
  ) LOOP
    EXECUTE 'ALTER TABLE public.sessions DROP CONSTRAINT ' || quote_ident(constraint_row.conname);
  END LOOP;

  ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_channel_check
    CHECK (channel IN ('text', 'voice', 'video-blur'));

  ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_status_check
    CHECK (status IN ('upcoming', 'completed', 'cancelled'));

  ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_payment_status_check
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON public.sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_psychologist_id ON public.sessions(psychologist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON public.sessions(scheduled_date, scheduled_time);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE status <> 'cancelled'
    GROUP BY psychologist_id, scheduled_date, scheduled_time
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Skipped unique active session slot index because duplicate active slots exist in public.sessions.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_unique_active_slot
      ON public.sessions(psychologist_id, scheduled_date, scheduled_time)
      WHERE status <> 'cancelled';
  END IF;
END $$;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Danışanlar kendi randevularını görebilir" ON public.sessions;
DROP POLICY IF EXISTS "Psikologlar kendi randevularını görebilir" ON public.sessions;
DROP POLICY IF EXISTS "Danışanlar randevu oluşturabilir" ON public.sessions;
DROP POLICY IF EXISTS "Katılımcılar kendi randevularını görebilir" ON public.sessions;
DROP POLICY IF EXISTS "Danışanlar kendi randevusunu oluşturabilir" ON public.sessions;
DROP POLICY IF EXISTS "Katılımcılar kendi randevusunu güncelleyebilir" ON public.sessions;
DROP POLICY IF EXISTS "sessions_select_participants" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert_client" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_participants" ON public.sessions;

CREATE POLICY "sessions_select_participants"
  ON public.sessions FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = psychologist_id);

CREATE POLICY "sessions_insert_client"
  ON public.sessions FOR INSERT
  WITH CHECK (
    auth.uid() = client_id
    AND status = 'upcoming'
    AND payment_status = 'pending'
    AND reviewed = false
  );

CREATE POLICY "sessions_update_participants"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = client_id OR auth.uid() = psychologist_id)
  WITH CHECK (auth.uid() = client_id OR auth.uid() = psychologist_id);

REVOKE UPDATE ON public.sessions FROM anon;
REVOKE UPDATE ON public.sessions FROM authenticated;
GRANT UPDATE (status, completed_at, cancellation_reason)
  ON public.sessions TO authenticated;

-- ==========================================
-- 4. Client profiles
-- ==========================================

CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  topics TEXT[] DEFAULT '{}',
  preferred_channel TEXT DEFAULT 'video-blur',
  emergency_name TEXT,
  emergency_phone TEXT,
  city TEXT,
  privacy_level INTEGER DEFAULT 5,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'video-blur';
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS emergency_name TEXT;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS privacy_level INTEGER DEFAULT 5;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.client_profiles'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%preferred_channel%'
        OR pg_get_constraintdef(oid) ILIKE '%privacy_level%'
      )
  ) LOOP
    EXECUTE 'ALTER TABLE public.client_profiles DROP CONSTRAINT ' || quote_ident(constraint_row.conname);
  END LOOP;

  ALTER TABLE public.client_profiles
    ADD CONSTRAINT client_profiles_preferred_channel_check
    CHECK (preferred_channel IN ('text', 'voice', 'video-blur'));

  ALTER TABLE public.client_profiles
    ADD CONSTRAINT client_profiles_privacy_level_check
    CHECK (privacy_level BETWEEN 1 AND 5);
END $$;

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.client_profiles', policy_row.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Danışanlar kendi profilini görebilir" ON public.client_profiles;
DROP POLICY IF EXISTS "Danışanlar kendi profilini oluşturabilir" ON public.client_profiles;
DROP POLICY IF EXISTS "Danışanlar kendi profilini güncelleyebilir" ON public.client_profiles;
DROP POLICY IF EXISTS "Adminler danışan profillerini görebilir" ON public.client_profiles;
DROP POLICY IF EXISTS "client_profiles_select_own" ON public.client_profiles;
DROP POLICY IF EXISTS "client_profiles_insert_own" ON public.client_profiles;
DROP POLICY IF EXISTS "client_profiles_update_own" ON public.client_profiles;
DROP POLICY IF EXISTS "client_profiles_select_admin" ON public.client_profiles;

CREATE POLICY "client_profiles_select_own"
  ON public.client_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "client_profiles_insert_own"
  ON public.client_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "client_profiles_update_own"
  ON public.client_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "client_profiles_select_admin"
  ON public.client_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- ==========================================
-- 5. Mood entries
-- ==========================================

CREATE TABLE IF NOT EXISTS public.mood_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  mood INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, date)
);

ALTER TABLE public.mood_entries ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.mood_entries ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.mood_entries ADD COLUMN IF NOT EXISTS mood INTEGER;
ALTER TABLE public.mood_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.mood_entries'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%mood%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.mood_entries DROP CONSTRAINT ' || quote_ident(constraint_row.conname);
  END LOOP;

  ALTER TABLE public.mood_entries
    ADD CONSTRAINT mood_entries_mood_check
    CHECK (mood BETWEEN 1 AND 5);
END $$;

CREATE INDEX IF NOT EXISTS idx_mood_entries_client_id ON public.mood_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_date ON public.mood_entries(client_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_entries_unique_client_date ON public.mood_entries(client_id, date);

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Danışanlar kendi ruh halini görebilir" ON public.mood_entries;
DROP POLICY IF EXISTS "Danışanlar ruh hali kaydı ekleyebilir" ON public.mood_entries;
DROP POLICY IF EXISTS "Danışanlar ruh hali kaydını güncelleyebilir" ON public.mood_entries;
DROP POLICY IF EXISTS "mood_entries_select_own" ON public.mood_entries;
DROP POLICY IF EXISTS "mood_entries_insert_own" ON public.mood_entries;
DROP POLICY IF EXISTS "mood_entries_update_own" ON public.mood_entries;

CREATE POLICY "mood_entries_select_own"
  ON public.mood_entries FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "mood_entries_insert_own"
  ON public.mood_entries FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "mood_entries_update_own"
  ON public.mood_entries FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- ==========================================
-- 6. Reviews
-- ==========================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_alias TEXT DEFAULT 'Anonim Danışan',
  psychologist_id UUID REFERENCES public.psychologists(id) ON DELETE CASCADE NOT NULL,
  rating NUMERIC(3,2) NOT NULL,
  categories JSONB DEFAULT '{}'::jsonb,
  comment TEXT,
  anonymous BOOLEAN DEFAULT true,
  channel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS client_alias TEXT DEFAULT 'Anonim Danışan';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS psychologist_id UUID REFERENCES public.psychologists(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS anonymous BOOLEAN DEFAULT true;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.reviews
  ALTER COLUMN rating TYPE NUMERIC(3,2)
  USING rating::numeric(3,2);

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%rating%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.reviews DROP CONSTRAINT ' || quote_ident(constraint_row.conname);
  END LOOP;

  ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_rating_check
    CHECK (rating BETWEEN 1 AND 5);
END $$;

CREATE INDEX IF NOT EXISTS idx_reviews_psychologist_id ON public.reviews(psychologist_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON public.reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_session_id ON public.reviews(session_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_reviews_unique_session_id'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.reviews
      WHERE session_id IS NOT NULL
      GROUP BY session_id
      HAVING COUNT(*) > 1
    ) THEN
      RAISE NOTICE 'Skipped unique review/session index because duplicate session_id values exist in public.reviews.';
    ELSE
      CREATE UNIQUE INDEX idx_reviews_unique_session_id
        ON public.reviews(session_id)
        WHERE session_id IS NOT NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Herkes psikolog yorumlarını görebilir" ON public.reviews;
DROP POLICY IF EXISTS "Danışanlar yorum oluşturabilir" ON public.reviews;
DROP POLICY IF EXISTS "Danışanlar kendi yorumlarını güncelleyebilir" ON public.reviews;
DROP POLICY IF EXISTS "Herkes yorumları okuyabilir" ON public.reviews;
DROP POLICY IF EXISTS "Danışanlar kendi seanslarına yorum yapabilir" ON public.reviews;
DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert_client_completed_session" ON public.reviews;
DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;

CREATE POLICY "reviews_select_public"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "reviews_insert_client_completed_session"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = client_id
    AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
        AND sessions.client_id = auth.uid()
        AND sessions.status = 'completed'
    )
  );

CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- ==========================================
-- 7. Review triggers
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_psychologist_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_psychologist_id UUID;
BEGIN
  target_psychologist_id := COALESCE(NEW.psychologist_id, OLD.psychologist_id);

  UPDATE public.psychologists
  SET
    rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)
      FROM public.reviews
      WHERE psychologist_id = target_psychologist_id
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE psychologist_id = target_psychologist_id
    )
  WHERE id = target_psychologist_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_rating ON public.reviews;
CREATE TRIGGER trigger_update_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_psychologist_rating();

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

-- ==========================================
-- 8. Auth profile trigger
-- ==========================================

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
SET search_path = ''
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
      COALESCE(NULLIF(metadata->>'name', ''), U&'Sakl\0131 Terapi Psikolo\011Fu'),
      UPPER(LEFT(COALESCE(NULLIF(metadata->>'name', ''), 'ST'), 1)),
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

-- ==========================================
-- 9. Optional admin promotion
-- ==========================================
-- Replace the email below with your real admin user's email and run it once.
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'your-admin-email@example.com';

-- Optional: approve and make a test psychologist bookable.
-- Replace the email below with your real psychologist account email.
-- UPDATE public.psychologists p
-- SET
--   approval_status = 'approved',
--   availability = '{
--     "Pazartesi": ["09:00", "10:00", "11:00", "14:00", "15:00"],
--     "Salı": ["09:00", "10:00", "14:00", "15:00"],
--     "Çarşamba": ["10:00", "11:00", "14:00"],
--     "Perşembe": ["09:00", "10:00", "11:00", "14:00"],
--     "Cuma": ["09:00", "10:00", "11:00"],
--     "Cumartesi": ["10:00", "11:00"],
--     "Pazar": ["14:00", "15:00"]
--   }'::jsonb
-- FROM public.profiles pr
-- WHERE p.id = pr.id
--   AND pr.email = 'your-psychologist-email@example.com';

-- ==========================================
-- Done
-- ==========================================
