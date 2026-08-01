import { supabase } from './supabase';

const VERIFICATION_BUCKET = 'psychologist-documents';
export const MAX_VERIFICATION_FILE_SIZE = 8 * 1024 * 1024;

export const DOCUMENT_TYPE_LABELS = {
  diploma: 'Diploma',
  student_certificate: 'Öğrenci belgesi',
  professional_certificate: 'Mesleki sertifika',
  other: 'Diğer mesleki belge',
};

const FILE_EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function getVerificationFileValidationCode(file) {
  if (!file) return 'required';
  if (!FILE_EXTENSIONS[file.type]) return 'unsupported';
  if (file.size < 1) return 'empty';
  if (file.size > MAX_VERIFICATION_FILE_SIZE) return 'tooLarge';
  return null;
}

const VALIDATION_MESSAGES_TR = {
  required: 'Yüklenecek dosyayı seçin.',
  unsupported: 'Yalnızca PDF, JPG veya PNG dosyası yükleyebilirsiniz.',
  empty: 'Boş dosyalar yüklenemez.',
  tooLarge: 'Dosya boyutu en fazla 8 MB olabilir.',
};

export function validateVerificationFile(file) {
  const code = getVerificationFileValidationCode(file);
  return code ? VALIDATION_MESSAGES_TR[code] : null;
}

export async function fetchMyVerificationDocuments(userId) {
  const { data, error } = await supabase
    .from('psychologist_verification_documents')
    .select('id, psychologist_id, document_type, storage_path, original_name, mime_type, size_bytes, status, review_reason, reviewed_at, created_at')
    .eq('psychologist_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function uploadVerificationDocument({ userId, documentType, file }) {
  const validationError = validateVerificationFile(file);
  if (validationError) throw new Error(validationError);
  if (!DOCUMENT_TYPE_LABELS[documentType]) throw new Error('Geçerli bir belge türü seçin.');
  if (!userId) throw new Error('Belge yüklemek için yeniden giriş yapın.');

  const extension = FILE_EXTENSIONS[file.type];
  const storagePath = `${userId}/${documentType}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from('psychologist_verification_documents')
    .insert({
      psychologist_id: userId,
      document_type: documentType,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select('id, psychologist_id, document_type, storage_path, original_name, mime_type, size_bytes, status, review_reason, reviewed_at, created_at')
    .single();

  if (insertError) {
    const { error: cleanupError } = await supabase.storage
      .from(VERIFICATION_BUCKET)
      .remove([storagePath]);
    if (cleanupError) console.error('Yükleme geri alınamadı:', cleanupError);
    throw insertError;
  }

  return data;
}

export async function removeVerificationDocument(document) {
  if (!document?.id || !document?.storage_path) throw new Error('Belge bilgisi eksik.');
  if (document.status === 'approved') throw new Error('Onaylanmış belgeler silinemez.');

  const { error: storageError } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .remove([document.storage_path]);
  if (storageError) throw storageError;

  const { error: deleteError } = await supabase
    .from('psychologist_verification_documents')
    .delete()
    .eq('id', document.id);
  if (deleteError) throw deleteError;
}

export async function createVerificationDocumentUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .createSignedUrl(storagePath, 120);

  if (error) throw error;
  return data.signedUrl;
}
