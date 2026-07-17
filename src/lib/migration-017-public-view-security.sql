-- ==========================================
-- GIZLIBIRIZ - Migration 017: Public view security
-- ==========================================
-- Run this after Migration 016. Public catalog views become security-invoker
-- views, while narrowly scoped functions retain the safe public projections.

BEGIN;

CREATE OR REPLACE FUNCTION public.read_public_psychologist_catalog()
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_initials text,
  title text,
  bio text,
  short_bio text,
  experience integer,
  rating numeric(3,2),
  review_count integer,
  session_count integer,
  is_candidate boolean,
  base_price integer,
  specializations text[],
  approaches text[],
  channels text[],
  availability jsonb,
  languages text[],
  university text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    psychologists.id,
    psychologists.display_name,
    psychologists.avatar_initials,
    psychologists.title,
    psychologists.bio,
    psychologists.short_bio,
    psychologists.experience,
    psychologists.rating,
    psychologists.review_count,
    psychologists.session_count,
    psychologists.is_candidate,
    psychologists.base_price,
    psychologists.specializations,
    psychologists.approaches,
    psychologists.channels,
    psychologists.availability,
    psychologists.languages,
    psychologists.university,
    psychologists.created_at
  FROM public.psychologists
  WHERE psychologists.approval_status = 'approved';
$$;

REVOKE ALL ON FUNCTION public.read_public_psychologist_catalog()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_public_psychologist_catalog()
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.read_public_review_catalog()
RETURNS TABLE (
  id uuid,
  psychologist_id uuid,
  rating numeric(3,2),
  categories jsonb,
  comment text,
  anonymous boolean,
  channel text,
  created_at timestamptz,
  client_alias text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    reviews.id,
    reviews.psychologist_id,
    reviews.rating,
    reviews.categories,
    reviews.comment,
    reviews.anonymous,
    reviews.channel,
    reviews.created_at,
    CASE
      WHEN reviews.anonymous THEN 'Anonim Danisan'
      ELSE COALESCE(reviews.client_alias, 'Anonim Danisan')
    END AS client_alias
  FROM public.reviews
  WHERE EXISTS (
    SELECT 1
    FROM public.psychologists
    WHERE psychologists.id = reviews.psychologist_id
      AND psychologists.approval_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.read_public_review_catalog()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_public_review_catalog()
  TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_psychologists
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  catalog.id,
  catalog.display_name,
  catalog.avatar_initials,
  catalog.title,
  catalog.bio,
  catalog.short_bio,
  catalog.experience,
  catalog.rating::numeric(3,2) AS rating,
  catalog.review_count,
  catalog.session_count,
  catalog.is_candidate,
  catalog.base_price,
  catalog.specializations,
  catalog.approaches,
  catalog.channels,
  catalog.availability,
  catalog.languages,
  catalog.university,
  catalog.created_at
FROM public.read_public_psychologist_catalog() AS catalog;

CREATE OR REPLACE VIEW public.public_reviews
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  catalog.id,
  catalog.psychologist_id,
  catalog.rating::numeric(3,2) AS rating,
  catalog.categories,
  catalog.comment,
  catalog.anonymous,
  catalog.channel,
  catalog.created_at,
  catalog.client_alias
FROM public.read_public_review_catalog() AS catalog;

REVOKE ALL ON TABLE public.public_psychologists
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.public_reviews
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_psychologists TO anon, authenticated;
GRANT SELECT ON TABLE public.public_reviews TO anon, authenticated;

COMMIT;
