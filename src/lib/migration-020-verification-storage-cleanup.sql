-- ==========================================
-- SAKLI TERAPI - Migration 020: Verification storage cleanup
-- ==========================================
-- Run this after Migration 019. Owners may remove orphaned objects after a
-- failed metadata insert or after deleting a pending/rejected metadata row.
-- Approved document objects remain protected.

BEGIN;

DROP POLICY IF EXISTS "psychologist_documents_storage_delete_owner"
  ON storage.objects;

CREATE POLICY "psychologist_documents_storage_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'psychologist-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT private.has_profile_role('psychologist'))
    AND NOT EXISTS (
      SELECT 1
      FROM public.psychologist_verification_documents AS documents
      WHERE documents.psychologist_id = (SELECT auth.uid())
        AND documents.storage_path = name
        AND documents.status = 'approved'
    )
  );

COMMIT;
