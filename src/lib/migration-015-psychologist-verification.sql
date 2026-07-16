-- ==========================================
-- GIZLIBIRIZ - Psychologist verification documents
-- Migration 015
-- ==========================================
-- Run this after Migration 014. Documents stay in a private Storage bucket;
-- only the owning psychologist and administrators can read them.

BEGIN;

CREATE TABLE IF NOT EXISTS public.psychologist_verification_documents (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  psychologist_id uuid NOT NULL
    REFERENCES public.psychologists(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (
    document_type IN (
      'diploma',
      'student_certificate',
      'professional_certificate',
      'other'
    )
  ),
  storage_path text NOT NULL UNIQUE CHECK (
    pg_catalog.char_length(storage_path) BETWEEN 40 AND 300
    AND storage_path LIKE psychologist_id::text || '/%'
    AND pg_catalog.strpos(storage_path, '..') = 0
  ),
  original_name text NOT NULL CHECK (
    pg_catalog.char_length(original_name) BETWEEN 1 AND 160
  ),
  mime_type text NOT NULL CHECK (
    mime_type IN ('application/pdf', 'image/jpeg', 'image/png')
  ),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 8388608),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  review_reason text CHECK (
    review_reason IS NULL
    OR pg_catalog.char_length(review_reason) BETWEEN 5 AND 500
  ),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_documents_psychologist_created
  ON public.psychologist_verification_documents(psychologist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_documents_status_created
  ON public.psychologist_verification_documents(status, created_at DESC);

ALTER TABLE public.psychologist_verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification_documents_select_owner"
  ON public.psychologist_verification_documents;
DROP POLICY IF EXISTS "verification_documents_select_admin"
  ON public.psychologist_verification_documents;
DROP POLICY IF EXISTS "verification_documents_insert_owner"
  ON public.psychologist_verification_documents;
DROP POLICY IF EXISTS "verification_documents_delete_owner"
  ON public.psychologist_verification_documents;
DROP POLICY IF EXISTS "verification_documents_delete_admin"
  ON public.psychologist_verification_documents;
DROP POLICY IF EXISTS "verification_documents_update_admin"
  ON public.psychologist_verification_documents;

CREATE POLICY "verification_documents_select_owner"
  ON public.psychologist_verification_documents FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = psychologist_id);

CREATE POLICY "verification_documents_select_admin"
  ON public.psychologist_verification_documents FOR SELECT
  TO authenticated
  USING ((SELECT private.is_admin_user()));

CREATE POLICY "verification_documents_insert_owner"
  ON public.psychologist_verification_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = psychologist_id
    AND (SELECT private.has_profile_role('psychologist'))
    AND status = 'pending'
    AND review_reason IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

CREATE POLICY "verification_documents_delete_owner"
  ON public.psychologist_verification_documents FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = psychologist_id
    AND status <> 'approved'
  );

CREATE POLICY "verification_documents_update_admin"
  ON public.psychologist_verification_documents FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_admin_user()))
  WITH CHECK ((SELECT private.is_admin_user()));

REVOKE ALL ON TABLE public.psychologist_verification_documents
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.psychologist_verification_documents
  TO authenticated;
GRANT INSERT (
  psychologist_id,
  document_type,
  storage_path,
  original_name,
  mime_type,
  size_bytes
) ON TABLE public.psychologist_verification_documents TO authenticated;
GRANT UPDATE (status, review_reason)
  ON TABLE public.psychologist_verification_documents TO authenticated;
GRANT ALL ON TABLE public.psychologist_verification_documents TO service_role;

CREATE OR REPLACE FUNCTION private.prepare_verification_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  NEW.original_name := pg_catalog.left(
    pg_catalog.btrim(NEW.original_name),
    160
  );

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.review_reason := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF actor_id IS NOT NULL AND NOT (SELECT private.is_admin_user()) THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.review_reason IS DISTINCT FROM OLD.review_reason
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
      RAISE EXCEPTION 'only admins can review verification documents'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'rejected'
       AND pg_catalog.char_length(
         COALESCE(NULLIF(pg_catalog.btrim(NEW.review_reason), ''), '')
       ) < 5 THEN
      RAISE EXCEPTION 'a review reason is required'
        USING ERRCODE = '22023';
    END IF;

    IF OLD.status = 'approved'
       AND NEW.status <> 'approved'
       AND EXISTS (
         SELECT 1
         FROM public.psychologists
         WHERE id = OLD.psychologist_id
           AND approval_status = 'approved'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM public.psychologist_verification_documents AS documents
         WHERE documents.psychologist_id = OLD.psychologist_id
           AND documents.id <> OLD.id
           AND documents.status = 'approved'
       ) THEN
      RAISE EXCEPTION 'an approved profile must retain an approved document'
        USING ERRCODE = '23514';
    END IF;

    NEW.review_reason := CASE
      WHEN NEW.status = 'rejected' THEN pg_catalog.left(
        NULLIF(pg_catalog.btrim(NEW.review_reason), ''),
        500
      )
      ELSE NULL
    END;
    NEW.reviewed_by := actor_id;
    NEW.reviewed_at := now();
  ELSIF actor_id IS NOT NULL
        AND (
          NEW.review_reason IS DISTINCT FROM OLD.review_reason
          OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
          OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
        ) THEN
    RAISE EXCEPTION 'document review fields change only with the status'
      USING ERRCODE = '42501';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_verification_document()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_prepare_verification_document
  ON public.psychologist_verification_documents;
CREATE TRIGGER trigger_prepare_verification_document
BEFORE INSERT OR UPDATE ON public.psychologist_verification_documents
FOR EACH ROW
EXECUTE FUNCTION private.prepare_verification_document();

CREATE OR REPLACE FUNCTION private.record_verification_document_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  psychologist_name text;
  notification_title text;
  notification_message text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT display_name
  INTO psychologist_name
  FROM public.psychologists
  WHERE id = NEW.psychologist_id;

  INSERT INTO public.admin_audit_log (
    actor_id,
    psychologist_id,
    action,
    metadata
  )
  VALUES (
    (SELECT auth.uid()),
    NEW.psychologist_id,
    'verification_document_' || NEW.status,
    pg_catalog.jsonb_build_object(
      'display_name', psychologist_name,
      'document_id', NEW.id,
      'document_type', NEW.document_type,
      'original_name', NEW.original_name,
      'previous_status', OLD.status,
      'new_status', NEW.status,
      'reason', NEW.review_reason
    )
  );

  notification_title := CASE NEW.status
    WHEN 'approved' THEN 'Mesleki belgeniz onaylandı'
    WHEN 'rejected' THEN 'Mesleki belgeniz yeniden isteniyor'
    ELSE 'Mesleki belgenizin durumu güncellendi'
  END;

  notification_message := CASE NEW.status
    WHEN 'approved' THEN 'Yüklediğiniz mesleki belge yönetici tarafından onaylandı.'
    WHEN 'rejected' THEN 'Yüklediğiniz mesleki belge incelendi. Açıklamayı belge ekranından görebilirsiniz.'
    ELSE 'Yüklediğiniz mesleki belgenin durumu güncellendi.'
  END;

  PERFORM private.create_notification(
    NEW.psychologist_id,
    'verification_document_' || NEW.status,
    notification_title,
    notification_message,
    '/ayarlar?tab=verification'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.record_verification_document_review()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_record_verification_document_review
  ON public.psychologist_verification_documents;
CREATE TRIGGER trigger_record_verification_document_review
AFTER UPDATE OF status ON public.psychologist_verification_documents
FOR EACH ROW
EXECUTE FUNCTION private.record_verification_document_review();

-- A catalog profile cannot be activated before an administrator has approved
-- at least one private verification document.
CREATE OR REPLACE FUNCTION private.prepare_psychologist_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF actor_id IS NOT NULL AND NOT (SELECT private.is_admin_user()) THEN
      RAISE EXCEPTION 'only admins can review psychologist applications'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.approval_status = 'approved'
       AND NOT EXISTS (
         SELECT 1
         FROM public.psychologist_verification_documents AS documents
         WHERE documents.psychologist_id = NEW.id
           AND documents.status = 'approved'
       ) THEN
      RAISE EXCEPTION 'at least one approved verification document is required'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.approval_status IN ('rejected', 'suspended')
       AND NULLIF(pg_catalog.btrim(NEW.review_reason), '') IS NULL THEN
      RAISE EXCEPTION 'a review reason is required'
        USING ERRCODE = '22023';
    END IF;

    NEW.review_reason := CASE
      WHEN NEW.approval_status = 'approved' THEN NULL
      ELSE pg_catalog.left(NULLIF(pg_catalog.btrim(NEW.review_reason), ''), 500)
    END;
    NEW.reviewed_at := now();
    NEW.reviewed_by := actor_id;
  ELSIF actor_id IS NOT NULL
        AND NOT (SELECT private.is_admin_user())
        AND (
          NEW.review_reason IS DISTINCT FROM OLD.review_reason
          OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
          OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
        ) THEN
    RAISE EXCEPTION 'psychologist review fields are server-managed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_psychologist_review()
  FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'psychologist-documents',
  'psychologist-documents',
  false,
  8388608,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "psychologist_documents_storage_insert_owner"
  ON storage.objects;
DROP POLICY IF EXISTS "psychologist_documents_storage_select_owner"
  ON storage.objects;
DROP POLICY IF EXISTS "psychologist_documents_storage_select_admin"
  ON storage.objects;
DROP POLICY IF EXISTS "psychologist_documents_storage_delete_owner"
  ON storage.objects;
DROP POLICY IF EXISTS "psychologist_documents_storage_delete_admin"
  ON storage.objects;

CREATE POLICY "psychologist_documents_storage_insert_owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'psychologist-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT private.has_profile_role('psychologist'))
  );

CREATE POLICY "psychologist_documents_storage_select_owner"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'psychologist-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT private.has_profile_role('psychologist'))
  );

CREATE POLICY "psychologist_documents_storage_select_admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'psychologist-documents'
    AND (SELECT private.is_admin_user())
  );

CREATE POLICY "psychologist_documents_storage_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'psychologist-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.psychologist_verification_documents AS documents
      WHERE documents.psychologist_id = (SELECT auth.uid())
        AND documents.storage_path = name
        AND documents.status <> 'approved'
    )
  );

COMMIT;
