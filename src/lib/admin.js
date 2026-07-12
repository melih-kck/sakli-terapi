import { supabase } from './supabase';

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
  return (data || []).map(flattenProfile);
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
