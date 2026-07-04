const reviewTemplates = [
  'Çok anlayışlı ve profesyonel bir yaklaşım sergiledi.',
  'Kendimi çok rahat hissetmemi sağladı, teşekkür ederim.',
  'İlk kez bu kadar rahat bir şekilde kendimi ifade edebildim.',
  'Dinleme becerisi muhteşem, gerçekten duyulduğumu hissettim.',
  'Pratik ve uygulanabilir öneriler sundu.',
  'Seans sonrasında kendimi çok daha iyi hissettim.',
  'Empati düzeyi çok yüksek, güven veren bir psikolog.',
  'Sorularıyla beni düşünmeye ve farkındalık kazanmaya yönlendirdi.',
  'Profesyonel ve sıcak bir atmosfer oluşturdu.',
  'Anonimlik sayesinde çok daha açık olabildim.',
  'Önceki seanslardaki gelişmelerimi takip etmesi çok güzel.',
  'Sabırlı ve destekleyici bir tutum sergiledi.',
  'Farklı bakış açıları sunarak düşüncelerimi genişletti.',
  'Güvenli bir alan oluşturarak rahatça konuşmamı sağladı.',
  'Terapi süreci hakkında net bilgi verdi, ne beklememem gerektiğini anlattı.',
];

const negativeTemplates = [
  'Bazen biraz daha fazla yönlendirme beklerdim.',
  'Seans süresi biraz kısa geldi, keşke daha uzun olsaydı.',
  'İlk seans biraz resmi hissettirdi ama sonrasında açıldık.',
  'Teknik terimleri bazen daha basit açıklayabilir.',
  'Daha fazla pratik egzersiz beklerdim.',
];

function generateReviews() {
  const reviews = [];
  let id = 1;

  for (let psychId = 1; psychId <= 15; psychId++) {
    const reviewCount = psychId <= 3 ? 15 : psychId <= 8 ? 10 : psychId <= 12 ? 8 : 5;
    
    for (let i = 0; i < reviewCount; i++) {
      const isPositive = Math.random() > 0.15;
      const rating = isPositive 
        ? (4 + Math.random()).toFixed(1) 
        : (3 + Math.random()).toFixed(1);
      
      const template = isPositive
        ? reviewTemplates[Math.floor(Math.random() * reviewTemplates.length)]
        : negativeTemplates[Math.floor(Math.random() * negativeTemplates.length)];
      
      const categoriesRating = {
        listening: Math.min(5, parseFloat(rating) + (Math.random() * 0.4 - 0.2)).toFixed(1),
        empathy: Math.min(5, parseFloat(rating) + (Math.random() * 0.4 - 0.2)).toFixed(1),
        professionalism: Math.min(5, parseFloat(rating) + (Math.random() * 0.3 - 0.1)).toFixed(1),
        communication: Math.min(5, parseFloat(rating) + (Math.random() * 0.4 - 0.2)).toFixed(1),
      };

      const daysAgo = Math.floor(Math.random() * 180);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      reviews.push({
        id: id++,
        psychologistId: psychId,
        clientAlias: `Anonim${Math.floor(Math.random() * 9000) + 1000}`,
        rating: parseFloat(rating),
        categoriesRating,
        comment: template,
        bestPart: isPositive ? 'Dinleme becerisi ve empati düzeyi çok iyi.' : '',
        improvePart: !isPositive ? template : '',
        freeComment: '',
        moodBefore: Math.floor(Math.random() * 3) + 1,
        moodAfter: Math.floor(Math.random() * 2) + 3,
        date: date.toISOString().split('T')[0],
        sessionNumber: Math.floor(Math.random() * 10) + 1,
        channel: ['text', 'voice', 'video-blur'][Math.floor(Math.random() * 3)],
        helpful: Math.floor(Math.random() * 30),
      });
    }
  }

  return reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export const mockReviews = generateReviews();
