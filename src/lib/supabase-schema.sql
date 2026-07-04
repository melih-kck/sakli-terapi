-- ==========================================
-- GIZLIBIRIZ SUPABASE DATABASE SCHEMA
-- ==========================================
-- DEPRECATED: Do not run this file for current setup.
-- Use supabase-complete-setup.sql for a fresh database, or
-- migration-006-rls-hardening.sql for the latest RLS hardening patch.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profil (Kullanıcı) Tablosu
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'psychologist', 'admin')),
  alias TEXT,
  name TEXT,
  privacy_level INTEGER DEFAULT 5 CHECK (privacy_level BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profilleri herkes görebilir." ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcılar kendi profillerini oluşturabilir." ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcılar kendi profillerini güncelleyebilir." ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcılar kendi profilini görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Adminler profilleri görebilir" ON public.profiles;

CREATE POLICY "Kullanıcılar kendi profilini görebilir"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Adminler profilleri görebilir"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.role = 'admin'
    )
  );

CREATE POLICY "Kullanıcılar kendi profillerini oluşturabilir"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Kullanıcılar kendi profillerini güncelleyebilir"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Psikolog Detayları Tablosu
CREATE TABLE IF NOT EXISTS public.psychologists (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_initials TEXT,
  title TEXT,
  bio TEXT,
  short_bio TEXT,
  experience INTEGER DEFAULT 0,
  rating DECIMAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  is_candidate BOOLEAN DEFAULT false,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  document_url TEXT,
  base_price INTEGER DEFAULT 1000,
  specializations TEXT[],
  approaches TEXT[],
  channels TEXT[],
  availability JSONB DEFAULT '{}'::jsonb,
  languages TEXT[] DEFAULT ARRAY['Türkçe'],
  university TEXT,
  supervisor TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS avatar_initials TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS short_bio TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['Türkçe'];
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS university TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS supervisor TEXT;

ALTER TABLE public.psychologists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Psikolog profillerini herkes görebilir." ON public.psychologists;
DROP POLICY IF EXISTS "Psikologlar kendi detaylarını güncelleyebilir." ON public.psychologists;
DROP POLICY IF EXISTS "Onaylı psikolog profillerini herkes görebilir" ON public.psychologists;
DROP POLICY IF EXISTS "Psikologlar kendi başvurusunu görebilir" ON public.psychologists;
DROP POLICY IF EXISTS "Psikologlar kendi başvurusunu oluşturabilir" ON public.psychologists;
DROP POLICY IF EXISTS "Psikologlar kendi detaylarını güncelleyebilir" ON public.psychologists;
DROP POLICY IF EXISTS "Adminler psikolog başvurularını yönetebilir" ON public.psychologists;

CREATE POLICY "Onaylı psikolog profillerini herkes görebilir"
  ON public.psychologists FOR SELECT
  USING (approval_status = 'approved');

CREATE POLICY "Psikologlar kendi başvurusunu görebilir"
  ON public.psychologists FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Psikologlar kendi başvurusunu oluşturabilir"
  ON public.psychologists FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'psychologist'
    )
  );

CREATE POLICY "Psikologlar kendi detaylarını güncelleyebilir"
  ON public.psychologists FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Adminler psikolog başvurularını yönetebilir"
  ON public.psychologists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.role = 'admin'
    )
  );

-- 3. Randevular (Seanslar) Tablosu
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  psychologist_id UUID REFERENCES public.psychologists(id) ON DELETE CASCADE NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('text', 'voice', 'video-blur')),
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
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

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS fee INTEGER;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS client_alias TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS psychologist_name TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS psychologist_initials TEXT;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Danışanlar kendi randevularını görebilir" ON public.sessions;
DROP POLICY IF EXISTS "Psikologlar kendi randevularını görebilir" ON public.sessions;
DROP POLICY IF EXISTS "Danışanlar randevu oluşturabilir" ON public.sessions;
DROP POLICY IF EXISTS "Katılımcılar kendi randevularını görebilir" ON public.sessions;
DROP POLICY IF EXISTS "Danışanlar kendi randevusunu oluşturabilir" ON public.sessions;
DROP POLICY IF EXISTS "Katılımcılar kendi randevusunu güncelleyebilir" ON public.sessions;

CREATE POLICY "Katılımcılar kendi randevularını görebilir"
  ON public.sessions FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = psychologist_id);

CREATE POLICY "Danışanlar kendi randevusunu oluşturabilir"
  ON public.sessions FOR INSERT
  WITH CHECK (
    auth.uid() = client_id
    AND status = 'upcoming'
    AND payment_status IN ('pending', 'paid')
  );

CREATE POLICY "Katılımcılar kendi randevusunu güncelleyebilir"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = client_id OR auth.uid() = psychologist_id)
  WITH CHECK (auth.uid() = client_id OR auth.uid() = psychologist_id);

CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON public.sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_psychologist_id ON public.sessions(psychologist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON public.sessions(scheduled_date, scheduled_time);

-- Supabase Realtime için SQL Editor'da bir kez çalıştırılabilir:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
