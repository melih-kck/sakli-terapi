-- 1. Yorumlar Tablosu (Reviews)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_alias TEXT,
  psychologist_id UUID REFERENCES public.psychologists(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  categories JSONB DEFAULT '{}'::jsonb,
  comment TEXT,
  anonymous BOOLEAN DEFAULT true,
  channel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) Etkinleştirme
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Politikalar:
-- 1. Herkes (Giriş yapan/yapmayan veya onaylı) yorumları okuyabilir
CREATE POLICY "Herkes yorumları okuyabilir"
  ON public.reviews FOR SELECT
  USING (true);

-- 2. Danışanlar kendi katıldıkları seanslara yorum yapabilir (Eğer seans tamamlandıysa kontrolü uygulama katmanından veya veritabanından yapılabilir)
CREATE POLICY "Danışanlar kendi seanslarına yorum yapabilir"
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

-- 3. Danışanlar kendi yorumlarını güncelleyebilir (İsteğe bağlı)
CREATE POLICY "Danışanlar kendi yorumlarını güncelleyebilir"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_reviews_psychologist_id ON public.reviews(psychologist_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON public.reviews(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_session_id ON public.reviews(session_id);

-- 2. Psikologlar Tablosu İçin İstatistik Alanları (Gerekiyorsa)
-- Eğer psikologların rating ortalamasını tabloda tutmak istersek:
-- ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0.0;
-- ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Trigger: Yeni bir yorum eklendiğinde psikoloğun ortalama puanını güncelleme
CREATE OR REPLACE FUNCTION update_psychologist_rating()
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

-- Trigger'ı oluştur (Eğer daha önce yoksa)
DROP TRIGGER IF EXISTS trigger_update_rating ON public.reviews;
CREATE TRIGGER trigger_update_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION update_psychologist_rating();
