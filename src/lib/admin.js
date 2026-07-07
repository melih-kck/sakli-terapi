import { supabase } from './supabase';

/**
 * Onay bekleyen psikologları getirir.
 * Bu sorgunun başarılı olması için çağrı yapan kullanıcının 'admin' yetkisine sahip olması gerekir.
 * (RLS policy tarafından korunmaktadır).
 */
export async function getPendingPsychologists() {
  try {
    const { data, error } = await supabase
      .from('psychologists')
      .select(`
        id,
        display_name,
        title,
        experience,
        approval_status,
        created_at,
        profiles!inner(email, role)
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // profiles ilişkisini düzleştirip veriyoruz
    return data.map(item => ({
      ...item,
      email: item.profiles?.email
    }));
  } catch (error) {
    console.error('getPendingPsychologists hatası:', error);
    throw error;
  }
}

/**
 * Sistemdeki onaylı psikologları getirir (Admin tarafı için).
 */
export async function getApprovedPsychologistsForAdmin() {
  try {
    const { data, error } = await supabase
      .from('psychologists')
      .select(`
        id,
        display_name,
        title,
        approval_status,
        created_at,
        profiles!inner(email)
      `)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data.map(item => ({
      ...item,
      email: item.profiles?.email
    }));
  } catch (error) {
    console.error('getApprovedPsychologistsForAdmin hatası:', error);
    throw error;
  }
}

/**
 * Psikoloğun başvurusunu onaylar.
 */
export async function approvePsychologist(psychologistId) {
  try {
    const { data, error } = await supabase
      .from('psychologists')
      .update({ approval_status: 'approved' })
      .eq('id', psychologistId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('approvePsychologist hatası:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Psikoloğun başvurusunu reddeder (veya onaylanmış psikoloğu askıya alır).
 */
export async function rejectPsychologist(psychologistId) {
  try {
    const { data, error } = await supabase
      .from('psychologists')
      .update({ approval_status: 'rejected' })
      .eq('id', psychologistId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('rejectPsychologist hatası:', error);
    return { success: false, error: error.message };
  }
}
