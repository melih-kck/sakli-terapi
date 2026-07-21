import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PsychologistDocumentsPanel from '../components/PsychologistDocumentsPanel';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../context/ToastContext';
import { APPROACHES, COMMUNICATION_CHANNELS, DAYS_TR, SPECIALIZATIONS } from '../data/constants';
import { supabase } from '../lib/supabase';
import { BRAND, getMailto } from '../config/brand';
import '../styles/pages/Settings.css';

const EDITABLE_CHANNELS = COMMUNICATION_CHANNELS.filter(channel => ['text', 'voice', 'video-blur'].includes(channel.id));
const DEFAULT_EMAIL_PREFERENCES = {
  emailSessionUpdates: false,
  emailReviewUpdates: false,
  emailAccountUpdates: false,
};

const getDefaultAvailability = () => (
  DAYS_TR.reduce((acc, day) => {
    acc[day] = day === 'Cumartesi' || day === 'Pazar' ? '' : '09:00, 10:00, 14:00';
    return acc;
  }, {})
);

const availabilityToForm = (availability = {}) => (
  DAYS_TR.reduce((acc, day) => {
    acc[day] = Array.isArray(availability[day]) ? availability[day].join(', ') : availability[day] || '';
    return acc;
  }, getDefaultAvailability())
);

const splitCommaList = (value = '') => (
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
);

const availabilityFromForm = (availability = {}) => (
  DAYS_TR.reduce((acc, day) => {
    const slots = splitCommaList(availability[day] || '');
    if (slots.length > 0) acc[day] = slots;
    return acc;
  }, {})
);

const getPsychologistSettings = (user) => {
  const profile = user?.psychologistProfile || {};
  return {
    title: profile.title || 'Psikolog',
    shortBio: profile.shortBio || '',
    bio: profile.bio || '',
    experience: Number(profile.experience || 0),
    basePrice: Number(profile.basePrice || 1000),
    specializations: profile.specializations || [],
    approaches: profile.approaches || [],
    channels: profile.channels?.length ? profile.channels : ['video-blur', 'voice', 'text'],
    languagesText: (profile.languages?.length ? profile.languages : ['Türkçe']).join(', '),
    university: profile.university || '',
    supervisor: profile.supervisor || '',
    availability: availabilityToForm(profile.availability),
  };
};

const getInitialTab = (search, user) => {
  const requestedTab = new URLSearchParams(search).get('tab');
  if (requestedTab === 'profile' && user?.role === 'psychologist') return 'profile';
  if (requestedTab === 'verification' && user?.role === 'psychologist') return 'verification';
  if (['account', 'notifications', 'privacy'].includes(requestedTab)) return requestedTab;
  return 'account';
};

const getDefaultSettings = (user) => ({
  displayName: user?.role === 'client' ? user?.alias || '' : user?.name || '',
  emergencyName: user?.clientProfile?.emergencyName || '',
  emergencyPhone: user?.clientProfile?.emergencyPhone || '',
  privacyLevel: user?.privacyLevel || 5,
  channel: user?.clientProfile?.preferredChannel || 'video-blur',
  psychologistProfile: getPsychologistSettings(user),
});

const getInitialSettings = (user) => getDefaultSettings(user);

export default function Settings() {
  const location = useLocation();
  const { user } = useAuth();
  const { updateProfile, updatePsychologistProfile, updateClientProfile, updatePassword } = useProfile();
  const { success, warning, error: showError } = useToast();

  const [activeTab, setActiveTab] = useState(() => getInitialTab(location.search, user));
  const [form, setForm] = useState(() => getInitialSettings(user));
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [emailPreferences, setEmailPreferences] = useState(DEFAULT_EMAIL_PREFERENCES);
  const [preferencesError, setPreferencesError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadEmailPreferences = async () => {
      if (!user?.id || user.id.startsWith('mock-')) return;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('email_session_updates, email_review_updates, email_account_updates')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isMounted) return;
      if (error) {
        console.error('E-posta bildirim tercihleri yüklenemedi:', error);
        setPreferencesError('E-posta tercihleri şu anda yüklenemiyor.');
        return;
      }

      if (data) {
        setEmailPreferences({
          emailSessionUpdates: data.email_session_updates,
          emailReviewUpdates: data.email_review_updates,
          emailAccountUpdates: data.email_account_updates,
        });
      }
      setPreferencesError('');
    };

    loadEmailPreferences();
    return () => { isMounted = false; };
  }, [user?.id]);

  const updateForm = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updatePsychologistForm = (key, value) => {
    setForm(prev => ({
      ...prev,
      psychologistProfile: { ...prev.psychologistProfile, [key]: value },
    }));
  };

  const togglePsychologistListItem = (key, value) => {
    setForm(prev => {
      const currentItems = prev.psychologistProfile[key] || [];
      const nextItems = currentItems.includes(value)
        ? currentItems.filter(item => item !== value)
        : [...currentItems, value];

      return {
        ...prev,
        psychologistProfile: { ...prev.psychologistProfile, [key]: nextItems },
      };
    });
  };

  const updateAvailability = (day, value) => {
    setForm(prev => ({
      ...prev,
      psychologistProfile: {
        ...prev.psychologistProfile,
        availability: { ...prev.psychologistProfile.availability, [day]: value },
      },
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      if (activeTab === 'notifications') {
        if (user.id.startsWith('mock-')) {
          success('Bildirim Tercihleri Kaydedildi', 'Test hesabı tercihleri bu tarayıcı oturumu için güncellendi.');
          return;
        }

        const { error } = await supabase
          .from('notification_preferences')
          .update({
            email_session_updates: emailPreferences.emailSessionUpdates,
            email_review_updates: emailPreferences.emailReviewUpdates,
            email_account_updates: emailPreferences.emailAccountUpdates,
          })
          .eq('user_id', user.id);

        if (error) {
          console.error('E-posta bildirim tercihleri kaydedilemedi:', error);
          showError('Tercihler Kaydedilemedi', 'E-posta bildirim tercihlerinizi güncelleyemedik.');
          return;
        }

        setPreferencesError('');
        success('Bildirim Tercihleri Kaydedildi', 'E-posta bildirim seçimleriniz güncellendi.');
        return;
      }

      const profileUpdates = {};

      if (activeTab === 'profile' && form.psychologistProfile.channels.length === 0) {
        showError('Profil Kaydedilemedi', 'En az bir görüşme kanalı seçmelisiniz.');
        return;
      }

      if (activeTab === 'account') {
        Object.assign(profileUpdates, user.role === 'client' ? { alias: form.displayName.trim() } : { name: form.displayName.trim() });
      }

      if (activeTab === 'privacy') {
        profileUpdates.privacyLevel = Number(form.privacyLevel);
      }

      if (activeTab === 'profile') {
        profileUpdates.name = form.displayName.trim();
      }

      const hasProfileUpdates = Object.keys(profileUpdates).length > 0;
      const result = hasProfileUpdates ? await updateProfile(profileUpdates) : { success: true };
      if (!result.success) return;

      const psychologistResult = activeTab === 'profile'
        ? await updatePsychologistProfile({
          displayName: form.displayName.trim(),
          title: form.psychologistProfile.title.trim(),
          shortBio: form.psychologistProfile.shortBio.trim(),
          bio: form.psychologistProfile.bio.trim(),
          experience: Number(form.psychologistProfile.experience || 0),
          basePrice: Number(form.psychologistProfile.basePrice || 0),
          specializations: form.psychologistProfile.specializations,
          approaches: form.psychologistProfile.approaches,
          channels: form.psychologistProfile.channels,
          languages: splitCommaList(form.psychologistProfile.languagesText),
          university: form.psychologistProfile.university.trim(),
          supervisor: form.psychologistProfile.supervisor.trim(),
          availability: availabilityFromForm(form.psychologistProfile.availability),
        })
        : { success: true };
      if (!psychologistResult.success) return;

      const clientUpdates = user.role !== 'client'
        ? null
        : activeTab === 'account'
          ? {
              emergencyName: form.emergencyName.trim(),
              emergencyPhone: form.emergencyPhone.trim(),
            }
          : activeTab === 'privacy'
            ? {
                preferredChannel: form.channel,
                privacyLevel: Number(form.privacyLevel),
              }
            : null;

      const clientResult = clientUpdates
        ? await updateClientProfile(clientUpdates)
        : { success: true };

      if (clientResult.success) {
        success('Ayarlar Kaydedildi', 'Hesap ve tercih bilgileriniz güncellendi.');
      }

    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!passwordForm.current) {
      showError('Şifre Güncellenemedi', 'Mevcut şifrenizi yazmalısınız.');
      return;
    }

    if (!passwordForm.next || passwordForm.next.length < 8) {
      showError('Şifre Güncellenemedi', 'Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }

    if (passwordForm.next !== passwordForm.confirm) {
      showError('Şifre Güncellenemedi', 'Yeni şifre ve tekrar alanı aynı olmalıdır.');
      return;
    }

    const result = await updatePassword(passwordForm.current, passwordForm.next);
    if (result.success) {
      setPasswordForm({ current: '', next: '', confirm: '' });
    }
  };

  if (!user) {
    return (
      <div className="page">
        <Navbar />
        <main className="page-content container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-center">
            <h2>Ayarlar sayfasına erişmek için giriş yapmalısınız.</h2>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <main className="page-content container mt-xl mb-3xl">
        <div className="text-center mb-xl">
          <h2>Hesap Ayarları</h2>
          <p className="text-tertiary">Hesap, profil ve gizlilik tercihlerinizi yönetin.</p>
        </div>

        <div className="grid grid-4 gap-lg">
          <div className="card h-fit">
            <div className="card-body" style={{ padding: '0' }}>
              <div className="tabs" style={{ flexDirection: 'column', border: 'none' }}>
                <button
                  type="button"
                  className={`tab-item ${activeTab === 'account' ? 'active' : ''}`}
                  onClick={() => setActiveTab('account')}
                  style={{ textAlign: 'left', borderLeft: activeTab === 'account' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                >
                  Hesap Bilgileri
                </button>
                {user.role === 'psychologist' && (
                  <>
                    <button
                      type="button"
                      className={`tab-item ${activeTab === 'profile' ? 'active' : ''}`}
                      onClick={() => setActiveTab('profile')}
                      style={{ textAlign: 'left', borderLeft: activeTab === 'profile' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                    >
                      Profilim
                    </button>
                    <button
                      type="button"
                      className={`tab-item ${activeTab === 'verification' ? 'active' : ''}`}
                      onClick={() => setActiveTab('verification')}
                      style={{ textAlign: 'left', borderLeft: activeTab === 'verification' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                    >
                      Mesleki Belgeler
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={`tab-item ${activeTab === 'notifications' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notifications')}
                  style={{ textAlign: 'left', borderLeft: activeTab === 'notifications' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                >
                  Bildirim Tercihleri
                </button>
                <button
                  type="button"
                  className={`tab-item ${activeTab === 'privacy' ? 'active' : ''}`}
                  onClick={() => setActiveTab('privacy')}
                  style={{ textAlign: 'left', borderLeft: activeTab === 'privacy' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                >
                  Gizlilik & Güvenlik
                </button>
              </div>
            </div>
          </div>

          <div className="card settings-content-card">
            <div className="card-header">
              <h3 style={{ margin: 0 }}>
                {activeTab === 'account' && 'Hesap Bilgileri'}
                {activeTab === 'profile' && 'Psikolog Profilim'}
                {activeTab === 'verification' && 'Mesleki Belgeler'}
                {activeTab === 'notifications' && 'Bildirim Tercihleri'}
                {activeTab === 'privacy' && 'Gizlilik & Güvenlik'}
              </h3>
            </div>

            <div className="card-body">
              {activeTab === 'verification' && user.role === 'psychologist' ? (
                <PsychologistDocumentsPanel user={user} />
              ) : (
                <form onSubmit={handleSave}>
                {activeTab === 'account' && (
                  <div className="grid gap-lg">
                    <div className="input-group">
                      <label>E-posta Adresiniz</label>
                      <input type="email" value={user.email || ''} disabled style={{ opacity: 0.7 }} />
                      <span className="input-hint">E-posta adresinizi değiştirmek için destek ile iletişime geçin.</span>
                    </div>

                    <div className="input-group">
                      <label>{user.role === 'client' ? 'Rumuz' : 'Ad Soyad'}</label>
                      <input
                        type="text"
                        value={form.displayName}
                        onChange={(event) => updateForm('displayName', event.target.value)}
                        placeholder={user.role === 'client' ? 'Anonim rumuzunuz' : 'Platformda görünen adınız'}
                      />
                      <span className="input-hint">
                        {user.role === 'client' ? 'Psikoloğunuz sizi bu isimle tanır.' : 'Psikolog listesinde ve panelde görünen adınız.'}
                      </span>
                    </div>

                    {user.role === 'client' && (
                      <div className="grid grid-2 gap-md">
                        <div className="input-group">
                          <label>Acil Durum Kişisi</label>
                          <input
                            type="text"
                            value={form.emergencyName}
                            onChange={(event) => updateForm('emergencyName', event.target.value)}
                            placeholder="Adı Soyadı"
                          />
                        </div>
                        <div className="input-group">
                          <label>Acil Durum Telefonu</label>
                          <input
                            type="tel"
                            value={form.emergencyPhone}
                            onChange={(event) => updateForm('emergencyPhone', event.target.value)}
                            placeholder="0555 555 55 55"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'profile' && user.role === 'psychologist' && (
                  <div className="grid gap-lg">
                    <div className="grid grid-2 gap-md">
                      <div className="input-group">
                        <label>Profilde Görünen Ad</label>
                        <input
                          type="text"
                          value={form.displayName}
                          onChange={(event) => updateForm('displayName', event.target.value)}
                          placeholder="Örn. Uzm. Psk. Ayşe Yılmaz"
                        />
                      </div>
                      <div className="input-group">
                        <label>Unvan</label>
                        <input
                          type="text"
                          value={form.psychologistProfile.title}
                          onChange={(event) => updatePsychologistForm('title', event.target.value)}
                          placeholder="Klinik Psikolog"
                        />
                      </div>
                    </div>

                    <div className="grid grid-2 gap-md">
                      <div className="input-group">
                        <label>Deneyim Yılı</label>
                        <input
                          type="number"
                          min="0"
                          value={form.psychologistProfile.experience}
                          onChange={(event) => updatePsychologistForm('experience', event.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label>Randevu Ücreti</label>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={form.psychologistProfile.basePrice}
                          onChange={(event) => updatePsychologistForm('basePrice', event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Kısa Tanıtım</label>
                      <input
                        type="text"
                        maxLength="160"
                        value={form.psychologistProfile.shortBio}
                        onChange={(event) => updatePsychologistForm('shortBio', event.target.value)}
                        placeholder="Liste kartlarında görünecek kısa açıklama"
                      />
                      <span className="input-hint">{form.psychologistProfile.shortBio.length}/160 karakter</span>
                    </div>

                    <div className="input-group">
                      <label>Hakkımda</label>
                      <textarea
                        rows="5"
                        value={form.psychologistProfile.bio}
                        onChange={(event) => updatePsychologistForm('bio', event.target.value)}
                        placeholder="Çalışma yaklaşımınızı, deneyiminizi ve danışanlara nasıl destek olduğunuzu yazın."
                      />
                    </div>

                    <div className="input-group">
                      <label>Uzmanlık Alanları</label>
                      <div className="filter-tags">
                        {SPECIALIZATIONS.map(spec => (
                          <button
                            key={spec.id}
                            type="button"
                            className={`tag ${form.psychologistProfile.specializations.includes(spec.id) ? 'active' : ''}`}
                            onClick={() => togglePsychologistListItem('specializations', spec.id)}
                          >
                            {spec.icon} {spec.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Terapi Yaklaşımları</label>
                      <div className="filter-tags">
                        {APPROACHES.map(approach => (
                          <button
                            key={approach.id}
                            type="button"
                            className={`tag ${form.psychologistProfile.approaches.includes(approach.id) ? 'active' : ''}`}
                            onClick={() => togglePsychologistListItem('approaches', approach.id)}
                          >
                            {approach.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Görüşme Kanalları</label>
                      <div className="grid grid-3 gap-sm">
                        {EDITABLE_CHANNELS.map(channel => (
                          <button
                            key={channel.id}
                            type="button"
                            className={`btn ${form.psychologistProfile.channels.includes(channel.id) ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => togglePsychologistListItem('channels', channel.id)}
                            style={{ border: '1px solid var(--border-light)' }}
                          >
                            {channel.icon} {channel.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-2 gap-md">
                      <div className="input-group">
                        <label>Konuştuğu Diller</label>
                        <input
                          type="text"
                          value={form.psychologistProfile.languagesText}
                          onChange={(event) => updatePsychologistForm('languagesText', event.target.value)}
                          placeholder="Türkçe, İngilizce"
                        />
                      </div>
                      <div className="input-group">
                        <label>Üniversite / Kurum</label>
                        <input
                          type="text"
                          value={form.psychologistProfile.university}
                          onChange={(event) => updatePsychologistForm('university', event.target.value)}
                          placeholder="Mezun olunan okul veya kurum"
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Süpervizör</label>
                      <input
                        type="text"
                        value={form.psychologistProfile.supervisor}
                        onChange={(event) => updatePsychologistForm('supervisor', event.target.value)}
                        placeholder="Aday psikologlar için süpervizör adı"
                      />
                    </div>

                    <div className="input-group">
                      <label>Haftalık Müsaitlik</label>
                      <div className="grid grid-2 gap-md">
                        {DAYS_TR.map(day => (
                          <div key={day} className="input-group">
                            <label>{day}</label>
                            <input
                              type="text"
                              value={form.psychologistProfile.availability[day] || ''}
                              onChange={(event) => updateAvailability(day, event.target.value)}
                              placeholder="09:00, 10:00, 14:00"
                            />
                          </div>
                        ))}
                      </div>
                      <span className="input-hint">Saatleri virgülle ayırın. Boş bıraktığınız gün randevuya kapalı görünür.</span>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="grid gap-lg">
                    <div className="input-group">
                      <label>Uygulama İçi Bildirimler</label>
                      <span className="input-hint">Randevu ve hesap işlemleri uygulama içinde her zaman gösterilir.</span>
                    </div>

                    {preferencesError && <p className="text-sm text-danger">{preferencesError}</p>}

                    <label className="checkbox-group notification-preference-option">
                      <input
                        type="checkbox"
                        checked={emailPreferences.emailSessionUpdates}
                        onChange={(event) => setEmailPreferences(current => ({
                          ...current,
                          emailSessionUpdates: event.target.checked,
                        }))}
                      />
                      <span>
                        <strong>Randevu e-postaları</strong><br />
                        <span className="input-hint">Yeni randevu, onay, iptal ve tamamlanma durumlarını e-postayla alın.</span>
                      </span>
                    </label>

                    {user.role === 'psychologist' && (
                      <label className="checkbox-group notification-preference-option">
                        <input
                          type="checkbox"
                          checked={emailPreferences.emailReviewUpdates}
                          onChange={(event) => setEmailPreferences(current => ({
                            ...current,
                            emailReviewUpdates: event.target.checked,
                          }))}
                        />
                        <span>
                          <strong>Başvuru durumu e-postaları</strong><br />
                          <span className="input-hint">Psikolog başvurunuz incelendiğinde e-posta alın.</span>
                        </span>
                      </label>
                    )}

                    <label className="checkbox-group notification-preference-option">
                      <input
                        type="checkbox"
                        checked={emailPreferences.emailAccountUpdates}
                        onChange={(event) => setEmailPreferences(current => ({
                          ...current,
                          emailAccountUpdates: event.target.checked,
                        }))}
                      />
                      <span>
                        <strong>Önemli hesap e-postaları</strong><br />
                        <span className="input-hint">Güvenlik ve hesap durumu bildirimlerini e-postayla alın.</span>
                      </span>
                    </label>

                    <div style={{ padding: 'var(--space-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                      Bu tercihler yalnızca operasyonel e-postaları yönetir. E-posta doğrulama ve şifre sıfırlama gibi zorunlu güvenlik iletileri her zaman gönderilir.
                    </div>
                  </div>
                )}

                {activeTab === 'privacy' && (
                  <div className="grid gap-lg">
                    <div className="card p-md" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                      <h4 className="mb-sm text-primary">Şifre</h4>
                      <div className="grid grid-2 gap-md">
                        <div className="input-group">
                          <label>Mevcut Şifreniz</label>
                          <input
                            type="password"
                            value={passwordForm.current}
                            onChange={(event) => setPasswordForm(prev => ({ ...prev, current: event.target.value }))}
                            placeholder="Mevcut şifre"
                            autoComplete="current-password"
                          />
                        </div>
                        <div className="input-group">
                          <label>Yeni Şifre</label>
                          <input
                            type="password"
                            value={passwordForm.next}
                            onChange={(event) => setPasswordForm(prev => ({ ...prev, next: event.target.value }))}
                            placeholder="En az 8 karakter"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      <div className="input-group mt-md">
                        <label>Yeni Şifre Tekrar</label>
                        <input
                          type="password"
                          value={passwordForm.confirm}
                          onChange={(event) => setPasswordForm(prev => ({ ...prev, confirm: event.target.value }))}
                          placeholder="Yeni şifreyi tekrar yazın"
                          autoComplete="new-password"
                        />
                      </div>
                      <button type="button" className="btn btn-outline btn-sm mt-md" onClick={handlePasswordUpdate}>
                        Şifreyi Güncelle
                      </button>
                    </div>

                    <div className="card p-md" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                      <h4 className="mb-md text-primary">Gizlilik Tercihleri</h4>

                      <div className="input-group mb-lg">
                        <label>Varsayılan Seans Giriş Tipi</label>
                        <div className="grid grid-3 gap-sm">
                          <button type="button" className={`btn ${form.channel === 'video-blur' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => updateForm('channel', 'video-blur')} style={{ border: '1px solid var(--border-light)' }}>Görüntülü (Blur)</button>
                          <button type="button" className={`btn ${form.channel === 'voice' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => updateForm('channel', 'voice')} style={{ border: '1px solid var(--border-light)' }}>Sadece Ses</button>
                          <button type="button" className={`btn ${form.channel === 'text' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => updateForm('channel', 'text')} style={{ border: '1px solid var(--border-light)' }}>Yazılı</button>
                        </div>
                      </div>

                      <div className="input-group">
                        <label>Gizlilik Seviyesi ({form.privacyLevel}/5)</label>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={form.privacyLevel}
                          onChange={(event) => updateForm('privacyLevel', Number(event.target.value))}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          <span>Açık İletişim</span>
                          <span>Maksimum Gizlilik</span>
                        </div>
                      </div>
                    </div>

                    <div className="card p-md mt-md" style={{ background: 'rgba(255, 82, 82, 0.05)', border: '1px solid var(--danger)' }}>
                      <h4 className="mb-sm text-danger">Tehlikeli Bölge</h4>
                      <p className="text-sm mb-md">Hesap silme talebi destek onayıyla ilerler; ani ve geri alınamaz silme burada yapılmaz.</p>
                      <a
                        className="btn btn-danger btn-sm"
                        href={getMailto(BRAND.supportEmail, 'Hesap silme talebi')}
                        onClick={() => warning('Hesap Silme', 'Talebinizi tamamlamak için destek ekibine e-posta gönderin.')}
                      >
                        Hesap Silme Talebi
                      </a>
                    </div>
                  </div>
                )}

                <div className="divider"></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setForm(getInitialSettings(user))}>İptal</button>
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                  </button>
                </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
