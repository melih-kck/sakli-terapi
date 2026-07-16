import { supabase } from './supabase';
import { createVerificationDocumentUrl } from './verification-documents';

const ADMIN_PSYCHOLOGIST_FIELDS = `
  id,
  display_name,
  title,
  experience,
  approval_status,
  review_reason,
  reviewed_at,
  created_at,
  profiles!inner(email, role)
`;

const flattenProfile = (item) => ({
  ...item,
  email: item.profiles?.email,
});

async function getPsychologistsByStatus(statuses) {
  let query = supabase
    .from('psychologists')
    .select(ADMIN_PSYCHOLOGIST_FIELDS)
    .order('created_at', { ascending: false });

  query = statuses.length === 1
    ? query.eq('approval_status', statuses[0])
    : query.in('approval_status', statuses);

  const { data, error } = await query;
  if (error) throw error;

  const psychologists = data || [];
  if (psychologists.length === 0) return [];

  const { data: documents, error: documentsError } = await supabase
    .from('psychologist_verification_documents')
    .select('id, psychologist_id, document_type, storage_path, original_name, mime_type, size_bytes, status, review_reason, reviewed_at, created_at')
    .in('psychologist_id', psychologists.map(item => item.id))
    .order('created_at', { ascending: false });

  if (documentsError) throw documentsError;

  return psychologists.map(item => ({
    ...flattenProfile(item),
    verification_documents: (documents || []).filter(document => (
      document.psychologist_id === item.id
    )),
  }));
}

export const getPendingPsychologists = () => getPsychologistsByStatus(['pending']);

export const getApprovedPsychologistsForAdmin = () => getPsychologistsByStatus(['approved']);

export const getInactivePsychologistsForAdmin = () => (
  getPsychologistsByStatus(['rejected', 'suspended'])
);

export async function getAdminAuditLog() {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('id, actor_id, psychologist_id, action, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

async function updatePsychologistStatus(psychologistId, status, reason = null) {
  try {
    const { data, error } = await supabase
      .from('psychologists')
      .update({
        approval_status: status,
        review_reason: reason,
      })
      .eq('id', psychologistId)
      .select('id, display_name, approval_status, review_reason, reviewed_at')
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Psikolog durumu güncellenemedi:', error);
    return { success: false, error: error.message };
  }
}

export const approvePsychologist = (psychologistId) => (
  updatePsychologistStatus(psychologistId, 'approved')
);

export const rejectPsychologist = (psychologistId, reason) => (
  updatePsychologistStatus(psychologistId, 'rejected', reason)
);

export const suspendPsychologist = (psychologistId, reason) => (
  updatePsychologistStatus(psychologistId, 'suspended', reason)
);

export async function reviewVerificationDocument(documentId, status, reason = null) {
  try {
    const { data, error } = await supabase
      .from('psychologist_verification_documents')
      .update({
        status,
        review_reason: reason,
      })
      .eq('id', documentId)
      .select('id, psychologist_id, document_type, status, review_reason, reviewed_at')
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Mesleki belge durumu güncellenemedi:', error);
    return { success: false, error: error.message };
  }
}

export const getVerificationDocumentUrl = (storagePath) => (
  createVerificationDocumentUrl(storagePath)
);
