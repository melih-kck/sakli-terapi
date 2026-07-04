-- ==========================================
-- GİZLİBİRİZ — Migration 001: Yeni Tablolar
-- reviews, client_profiles, mood_entries
-- ==========================================
-- DEPRECATED: Do not run this standalone file for the current project.
-- Use supabase-complete-setup.sql, then migration-006-rls-hardening.sql if needed.
-- Bu SQL kodunu Supabase Dashboard > SQL Editor'da çalıştırın.

-- 1. Değerlendirmeler (Reviews) Tablosu
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  psychologist_id UUID REFERENCES public.psychologists(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_alias TEXT DEFAULT 'Anonim Danışan',
  rating DECIMAL NOT NULL CHECK (rating BETWEEN 1 AND 5),
  categories JSONB DEFAULT '{}'::jsonb,
  comment TEXT,
  anonymous BOOLEAN DEFAULT true,
  channel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Herkes onaylı psikologların yorumlarını görebilir
CREATE POLICY "Herkes psikolog yorumlarını görebilir"
  ON public.reviews FOR SELECT
  USING (true);

-- Danışanlar kendi yorumlarını oluşturabilir
CREATE POLICY "Danışanlar yorum oluşturabilir"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- Danışanlar kendi yorumlarını güncelleyebilir
CREATE POLICY "Danışanlar kendi yorumlarını güncelleyebilir"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE INDEX IF NOT EXISTS idx_reviews_psychologist_id ON public.reviews(psychologist_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON public.reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_session_id ON public.reviews(session_id);


-- 2. Danışan Profilleri (Client Profiles) Tablosu
CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  topics TEXT[] DEFAULT '{}',
  preferred_channel TEXT DEFAULT 'video-blur' CHECK (preferred_channel IN ('text', 'voice', 'video-blur')),
  emergency_name TEXT,
  emergency_phone TEXT,
  city TEXT,
  privacy_level INTEGER DEFAULT 5 CHECK (privacy_level BETWEEN 1 AND 5),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Danışanlar kendi profillerini görebilir
CREATE POLICY "Danışanlar kendi profilini görebilir"
  ON public.client_profiles FOR SELECT
  USING (auth.uid() = id);

-- Danışanlar kendi profillerini oluşturabilir
CREATE POLICY "Danışanlar kendi profilini oluşturabilir"
  ON public.client_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Danışanlar kendi profillerini güncelleyebilir
CREATE POLICY "Danışanlar kendi profilini güncelleyebilir"
  ON public.client_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Adminler danışan profillerini görebilir
CREATE POLICY "Adminler danışan profillerini görebilir"
  ON public.client_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.role = 'admin'
    )
  );


-- 3. Ruh Hali Kayıtları (Mood Entries) Tablosu
CREATE TABLE IF NOT EXISTS public.mood_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, date)
);

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

-- Danışanlar kendi ruh hali kayıtlarını görebilir
CREATE POLICY "Danışanlar kendi ruh halini görebilir"
  ON public.mood_entries FOR SELECT
  USING (auth.uid() = client_id);

-- Danışanlar kendi ruh hali kaydı ekleyebilir
CREATE POLICY "Danışanlar ruh hali kaydı ekleyebilir"
  ON public.mood_entries FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- Danışanlar kendi ruh hali kaydını güncelleyebilir (aynı gün tekrar)
CREATE POLICY "Danışanlar ruh hali kaydını güncelleyebilir"
  ON public.mood_entries FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE INDEX IF NOT EXISTS idx_mood_entries_client_id ON public.mood_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_date ON public.mood_entries(client_id, date);


-- 4. Sessions tablosuna reviewed sütunu ekle (yoksa)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false;

-- 5. Sessions tablosuna fee sütunu ekle (yoksa)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS fee INTEGER;

-- 6. Sessions tablosuna cancellation_reason sütunu ekle (yoksa)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 7. Sessions tablosuna client_alias sütunu ekle (yoksa)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS client_alias TEXT;

-- 8. Sessions tablosuna psychologist_name sütunu ekle (yoksa)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS psychologist_name TEXT;

-- TAMAM! 3 yeni tablo + 5 yeni sütun oluşturuldu.
-- Çıktıda "Success" göreceksiniz.
