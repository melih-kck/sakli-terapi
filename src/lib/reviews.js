import { supabase } from './supabase';

/**
 * Yeni bir değerlendirme (review) gönderir.
 * @param {Object} reviewData
 * @param {string} reviewData.sessionId - Tamamlanan seansın ID'si
 * @param {string} reviewData.psychologistId - Psikoloğun ID'si
 * @param {string} reviewData.clientId - Danışanın ID'si
 * @param {number} reviewData.rating - Verilen puan (1-5)
 * @param {string} reviewData.comment - (Opsiyonel) Yorum metni
 * @returns {Promise<{success: boolean, error?: string, data?: any}>}
 */
export const submitReview = async ({
  sessionId,
  psychologistId,
  clientId,
  clientAlias = 'Anonim Danışan',
  rating,
  categoriesRating = {},
  comment = '',
  anonymous = true,
  channel = null,
}) => {
  // Mock fallback if user is mock
  if (String(clientId).startsWith('mock-')) {
    try {
      const stored = localStorage.getItem('mock_user_session');
      if (stored) {
        const mockUser = JSON.parse(stored);
        
        // Update the session to mark it as reviewed
        const sessionIndex = mockUser.sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex !== -1) {
          mockUser.sessions[sessionIndex].reviewed = true;
        }

        // Add review to mock user profile (for testing purposes)
        if (!mockUser.reviews) mockUser.reviews = [];
        mockUser.reviews.push({
          id: `review-${crypto.randomUUID()}`,
          session_id: sessionId,
          psychologist_id: psychologistId,
          client_id: clientId,
          client_alias: clientAlias,
          rating,
          categories: categoriesRating,
          comment,
          anonymous,
          channel,
          created_at: new Date().toISOString()
        });

        localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
        return { success: true, data: mockUser.reviews[mockUser.reviews.length - 1] };
      }
    } catch (err) {
      console.error('Mock review hatası:', err);
      return { success: false, error: 'Yerel değerlendirme kaydedilemedi.' };
    }
  }

  // Real Supabase insert
  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert([{
        session_id: sessionId,
        client_id: clientId,
        client_alias: clientAlias,
        psychologist_id: psychologistId,
        rating: Number(rating),
        categories: categoriesRating,
        comment: comment.trim(),
        anonymous,
        channel,
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // UNIQUE constraint violation
        return { success: false, error: 'Bu seans için zaten bir değerlendirme yaptınız.' };
      }
      throw error;
    }

    await supabase
      .from('sessions')
      .update({ reviewed: true })
      .eq('id', sessionId)
      .eq('client_id', clientId);

    return { success: true, data };
  } catch (error) {
    console.error('Değerlendirme kaydedilirken hata:', error);
    return { success: false, error: error.message || 'Değerlendirme kaydedilemedi.' };
  }
};

/**
 * Belirli bir psikoloğa ait değerlendirmeleri çeker.
 * @param {string} psychologistId 
 * @returns {Promise<{success: boolean, reviews: Array, error?: string}>}
 */
export const getPsychologistReviews = async (psychologistId) => {
  // Eğer mock (hardcoded) bir psikolog ise (uuid formatında değilse)
  if (!psychologistId || psychologistId.toString().length < 20) {
    // Return empty array for local hardcoded psychologists 
    // unless they have a mock mechanism implemented in local-reviews.js
    return { success: true, reviews: [] };
  }

  try {
    // Yorumları public review alanlarından çek; profiles join'i RLS nedeniyle
    // client dışı kullanıcılar için gereksiz hata üretebilir.
    const { data, error } = await supabase
      .from('public_reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        client_alias,
        anonymous
      `)
      .eq('psychologist_id', psychologistId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format the response
    const formattedReviews = data.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      clientAlias: review.anonymous ? 'Anonim Danışan' : (review.client_alias || 'Anonim Danışan')
    }));

    return { success: true, reviews: formattedReviews };
  } catch (error) {
    console.error('Yorumlar çekilirken hata:', error);
    return { success: false, error: error.message || 'Yorumlar yüklenemedi.' };
  }
};
