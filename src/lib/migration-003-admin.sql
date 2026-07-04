-- ==========================================
-- GİZLİBİRİZ — Migration 003: Admin Kullanıcısı Kesin Çözüm
-- ==========================================
-- DEPRECATED: Do not run this standalone file for the current project.
-- Use supabase-complete-setup.sql, then migration-006-rls-hardening.sql if needed.

-- PostgreSQL'in eski isimsiz kurala (CHECK constraint) atadığı rastgele adı 
-- bulup otomatik olarak siliyoruz.
DO $$ 
DECLARE 
    r record;
BEGIN 
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
        AND contype = 'c'
    ) LOOP 
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(r.conname); 
    END LOOP; 
END $$;

-- Yeni ve doğru kuralı ekliyoruz
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('client', 'psychologist', 'admin'));

-- E-posta adresini güncelliyoruz.
-- LÜTFEN AŞAĞIDAKİ MAİL ADRESİNİ KENDİ AÇTIĞINIZ DANIŞAN MAİLİYLE DEĞİŞTİRİN:
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'danisan_yeni@gizlibiriz.com';
