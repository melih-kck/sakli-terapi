export const SPECIALIZATIONS = [
  { id: 'anxiety', label: 'Anksiyete', icon: '😰', description: 'Kaygı bozuklukları, panik atak, sosyal fobi' },
  { id: 'depression', label: 'Depresyon', icon: '😔', description: 'Depresif bozukluklar, duygudurum sorunları' },
  { id: 'relationship', label: 'İlişki Sorunları', icon: '💔', description: 'Romantik ilişkiler, evlilik sorunları, bağlanma' },
  { id: 'trauma', label: 'Travma & TSSB', icon: '🩹', description: 'Travma sonrası stres, travmatik yaşantılar' },
  { id: 'ocd', label: 'OKB', icon: '🔄', description: 'Obsesif kompulsif bozukluk' },
  { id: 'eating', label: 'Yeme Bozuklukları', icon: '🍽️', description: 'Anoreksiya, bulimia, aşırı yeme' },
  { id: 'grief', label: 'Yas & Kayıp', icon: '🕊️', description: 'Yas süreci, kayıp ve ayrılık' },
  { id: 'stress', label: 'Stres Yönetimi', icon: '🧘', description: 'İş stresi, tükenmişlik, yaşam dengesi' },
  { id: 'career', label: 'Kariyer Danışmanlığı', icon: '💼', description: 'Kariyer planlama, iş hayatı sorunları' },
  { id: 'family', label: 'Aile Terapisi', icon: '👨‍👩‍👧', description: 'Aile içi iletişim, ebeveyn-çocuk ilişkisi' },
  { id: 'self-esteem', label: 'Özgüven', icon: '💪', description: 'Benlik saygısı, öz değer, kendini kabul' },
  { id: 'addiction', label: 'Bağımlılık', icon: '⛓️', description: 'Madde bağımlılığı, davranışsal bağımlılıklar' },
  { id: 'sleep', label: 'Uyku Bozuklukları', icon: '😴', description: 'İnsomnia, uyku kalitesi sorunları' },
  { id: 'anger', label: 'Öfke Yönetimi', icon: '😤', description: 'Öfke kontrolü, duygusal düzenleme' },
  { id: 'child', label: 'Çocuk & Ergen', icon: '🧒', description: 'Çocuk psikolojisi, ergenlik sorunları' },
];

export const APPROACHES = [
  { id: 'cbt', label: 'Bilişsel Davranışçı Terapi (BDT)', description: 'Düşünce kalıplarını değiştirmeye odaklanır' },
  { id: 'psychodynamic', label: 'Psikodinamik Terapi', description: 'Bilinçaltı süreçleri ve geçmiş deneyimleri inceler' },
  { id: 'humanistic', label: 'Hümanistik Terapi', description: 'Bireysel potansiyeli ve kendini gerçekleştirmeyi destekler' },
  { id: 'emdr', label: 'EMDR', description: 'Göz hareketleri ile duyarsızlaştırma ve yeniden işleme' },
  { id: 'gestalt', label: 'Gestalt Terapi', description: 'Şimdi ve burada deneyimine odaklanır' },
  { id: 'schema', label: 'Şema Terapi', description: 'Erken dönem uyumsuz şemaları ele alır' },
  { id: 'act', label: 'Kabul ve Kararlılık Terapisi (ACT)', description: 'Psikolojik esnekliği artırmayı hedefler' },
  { id: 'solution', label: 'Çözüm Odaklı Terapi', description: 'Sorun yerine çözüme odaklanır' },
  { id: 'systemic', label: 'Sistemik Aile Terapisi', description: 'Aile ve ilişki sistemlerini ele alır' },
  { id: 'existential', label: 'Varoluşçu Terapi', description: 'Yaşamın anlamı ve varoluşsal kaygıları inceler' },
];

export const COMMUNICATION_CHANNELS = [
  { id: 'text', label: 'Metin (Chat)', icon: '💬', privacy: 'Maksimum', description: 'Tamamen anonim yazışma' },
  { id: 'voice', label: 'Sesli Görüşme', icon: '🎙️', privacy: 'Yüksek', description: 'Ses filtresi opsiyonel' },
  { id: 'video-blur', label: 'Görüntülü (Blurlu)', icon: '📹', privacy: 'Orta', description: 'Yüz bulanık, ses doğal' },
];

export const DAYS_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
