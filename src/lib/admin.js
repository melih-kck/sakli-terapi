import { supabase } from './supabase';
import { createVerificationDocumentUrl } from './verification-documents';
import { IS_DEMO_MODE } from '../config/runtime';

const DEMO_ADMIN_STORAGE_KEY = 'sakli-terapi-demo-admin-v1';

const createDemoAdminState = () => ({
  psychologists: [
    {
      id: 'demo-application-pending',
      display_name: 'Kurgusal Başvuru 01',
      email: 'basvuru01@demo.sakliterapi.local',
      title: 'Klinik Psikolog',
      experience: 4,
      approval_status: 'pending',
      review_reason: '',
      reviewed_at: null,
      created_at: '2026-07-24T09:30:00.000Z',
      verification_documents: [
        {
          id: 'demo-document-01',
          psychologist_id: 'demo-application-pending',
          document_type: 'diploma',
          storage_path: '/demo-belge.html',
          original_name: 'kurgusal-klinik-psikoloji-belgesi.html',
          mime_type: 'text/html',
          size_bytes: 1820,
          status: 'pending',
          review_reason: '',
          reviewed_at: null,
          created_at: '2026-07-24T09:35:00.000Z',
        },
      ],
    },
    {
      id: 'demo-application-approved',
      display_name: 'Kurgusal Uzman 02',
      email: 'uzman02@demo.sakliterapi.local',
      title: 'Klinik Psikolog',
      experience: 8,
      approval_status: 'approved',
      review_reason: '',
      reviewed_at: '2026-07-21T14:15:00.000Z',
      created_at: '2026-07-20T10:00:00.000Z',
      verification_documents: [
        {
          id: 'demo-document-02',
          psychologist_id: 'demo-application-approved',
          document_type: 'diploma',
          storage_path: '/demo-belge.html',
          original_name: 'kurgusal-onayli-belge.html',
          mime_type: 'text/html',
          size_bytes: 1820,
          status: 'approved',
          review_reason: '',
          reviewed_at: '2026-07-21T14:10:00.000Z',
          created_at: '2026-07-20T10:05:00.000Z',
        },
      ],
    },
    {
      id: 'demo-application-suspended',
      display_name: 'Kurgusal Uzman 03',
      email: 'uzman03@demo.sakliterapi.local',
      title: 'Klinik Psikolog',
      experience: 6,
      approval_status: 'suspended',
      review_reason: 'Demo denetim akışını göstermek için askıya alındı.',
      reviewed_at: '2026-07-23T16:45:00.000Z',
      created_at: '2026-07-18T11:00:00.000Z',
      verification_documents: [
        {
          id: 'demo-document-03',
          psychologist_id: 'demo-application-suspended',
          document_type: 'diploma',
          storage_path: '/demo-belge.html',
          original_name: 'kurgusal-askidaki-belge.html',
          mime_type: 'text/html',
          size_bytes: 1820,
          status: 'approved',
          review_reason: '',
          reviewed_at: '2026-07-19T12:00:00.000Z',
          created_at: '2026-07-18T11:05:00.000Z',
        },
      ],
    },
  ],
  auditLog: [
    {
      id: 'demo-audit-01',
      actor_id: 'mock-admin',
      psychologist_id: 'demo-application-suspended',
      action: 'psychologist_suspended',
      metadata: {
        display_name: 'Kurgusal Uzman 03',
        reason: 'Demo denetim akışını göstermek için askıya alındı.',
      },
      created_at: '2026-07-23T16:45:00.000Z',
    },
  ],
});

const cloneDemoValue = (value) => JSON.parse(JSON.stringify(value));

const readDemoAdminState = () => {
  try {
    const stored = localStorage.getItem(DEMO_ADMIN_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    localStorage.removeItem(DEMO_ADMIN_STORAGE_KEY);
  }

  const initial = createDemoAdminState();
  localStorage.setItem(DEMO_ADMIN_STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

const writeDemoAdminState = (state) => {
  localStorage.setItem(DEMO_ADMIN_STORAGE_KEY, JSON.stringify(state));
};

const getDemoPsychologistsByStatus = (statuses) => (
  cloneDemoValue(
    readDemoAdminState().psychologists.filter(item => statuses.includes(item.approval_status)),
  )
);

const addDemoAuditEntry = (state, psychologist, action, reason = null) => {
  state.auditLog.unshift({
    id: `demo-audit-${crypto.randomUUID()}`,
    actor_id: 'mock-admin',
    psychologist_id: psychologist.id,
    action,
    metadata: {
      display_name: psychologist.display_name,
      reason,
    },
    created_at: new Date().toISOString(),
  });
};

const ADMIN_PSYCHOLOGIST_FIELDS = `
  id,
  display_name,
  title,
  experience,
  approval_status,
  review_reason,
  reviewed_at,
  created_at,
  profiles!psychologists_id_fkey(email, role)
`;

const flattenProfile = (item) => ({
  ...item,
  email: item.profiles?.email,
});

async function getPsychologistsByStatus(statuses) {
  if (IS_DEMO_MODE) return getDemoPsychologistsByStatus(statuses);

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
  if (IS_DEMO_MODE) {
    return cloneDemoValue(readDemoAdminState().auditLog);
  }

  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('id, actor_id, psychologist_id, action, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

async function updatePsychologistStatus(psychologistId, status, reason = null) {
  if (IS_DEMO_MODE) {
    const state = readDemoAdminState();
    const psychologist = state.psychologists.find(item => item.id === psychologistId);
    if (!psychologist) return { success: false, error: 'Demo başvurusu bulunamadı.' };

    psychologist.approval_status = status;
    psychologist.review_reason = reason || '';
    psychologist.reviewed_at = new Date().toISOString();
    const action = status === 'approved'
      ? 'psychologist_approved'
      : status === 'suspended'
        ? 'psychologist_suspended'
        : 'psychologist_rejected';
    addDemoAuditEntry(state, psychologist, action, reason);
    writeDemoAdminState(state);
    return { success: true, data: cloneDemoValue(psychologist) };
  }

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
  if (IS_DEMO_MODE) {
    const state = readDemoAdminState();
    const psychologist = state.psychologists.find(item => (
      item.verification_documents.some(document => document.id === documentId)
    ));
    const document = psychologist?.verification_documents.find(item => item.id === documentId);
    if (!psychologist || !document) {
      return { success: false, error: 'Demo belgesi bulunamadı.' };
    }

    document.status = status;
    document.review_reason = reason || '';
    document.reviewed_at = new Date().toISOString();
    addDemoAuditEntry(
      state,
      psychologist,
      status === 'approved' ? 'verification_document_approved' : 'verification_document_rejected',
      reason,
    );
    writeDemoAdminState(state);
    return { success: true, data: cloneDemoValue(document) };
  }

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

export const getVerificationDocumentUrl = (storagePath) => {
  if (IS_DEMO_MODE) {
    return new URL('/demo-belge.html', window.location.origin).toString();
  }
  return createVerificationDocumentUrl(storagePath);
};

export const resetDemoAdminData = () => {
  if (!IS_DEMO_MODE) return false;
  writeDemoAdminState(createDemoAdminState());
  return true;
};
