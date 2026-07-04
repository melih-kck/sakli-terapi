-- ==========================================
-- GİZLİBİRİZ — Migration 002: Eksik Sütunlar
-- ==========================================
-- Bu SQL kodunu Supabase Dashboard > SQL Editor'da çalıştırın.

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Çıktıda "Success" görmelisiniz.
