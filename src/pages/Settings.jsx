import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PsychologistDocumentsPanel from '../components/PsychologistDocumentsPanel';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { APPROACHES, COMMUNICATION_CHANNELS, DAYS_TR, SPECIALIZATIONS } from '../data/constants';
import { supabase } from '../lib/supabase';
import { BRAND, getMailto } from '../config/brand';
import { IS_DEMO_MODE } from '../config/runtime';
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
    basePrice: Number(profile.basePrice ?? 1000),
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
  const { t } = useLanguage();

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
          success(t('settingsPage.preferencesSavedTitle'), t('settingsPage.demoPreferencesSaved'));
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
        success(t('settingsPage.preferencesSavedTitle'), t('settingsPage.preferencesSaved'));
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
        success(t('settingsPage.settingsSavedTitle'), t('settingsPage.settingsSaved'));
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
            <h2>{t('settingsPage.noAccess')}</h2>
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
          <h1 className="settings-page-title">{t('settingsPage.title')}</h1>
          <p className="text-tertiary">{t('settingsPage.subtitle')}</p>
        </div>

        <div className="grid grid-4 gap-lg">
          <div className="card h-fit">
            <div className="card-body" style={{ padding: '0' }}>
              <div className="tabs" role="tablist" aria-label={t('settingsPage.tabsLabel')} style={{ flexDirection: 'column', border: 'none' }}>
                <button
                  type="button"
                  id="settings-tab-account"
                  role="tab"
                  aria-selected={activeTab === 'account'}
                  aria-controls="settings-panel"
                  className={`tab-item ${activeTab === 'account' ? 'active' : ''}`}
                  onClick={() => setActiveTab('account')}
                  style={{ textAlign: 'left', borderLeft: activeTab === 'account' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                >
                  {t('settingsPage.account')}
                </button>
                {user.role === 'psychologist' && (
                  <>
                    <button
                      type="button"
                      id="settings-tab-profile"
                      role="tab"
                      aria-selected={activeTab === 'profile'}
                      aria-controls="settings-panel"
                      className={`tab-item ${activeTab === 'profile' ? 'active' : ''}`}
                      onClick={() => setActiveTab('profile')}
                      style={{ textAlign: 'left', borderLeft: activeTab === 'profile' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                    >
                      {t('settingsPage.profile')}
                    </button>
                    <button
                      type="button"
                      id="settings-tab-verification"
                      role="tab"
                      aria-selected={activeTab === 'verification'}
                      aria-controls="settings-panel"
                      className={`tab-item ${activeTab === 'verification' ? 'active' : ''}`}
                      onClick={() => setActiveTab('verification')}
                      style={{ textAlign: 'left', borderLeft: activeTab === 'verification' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                    >
                      {t('settingsPage.documents')}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  id="settings-tab-notifications"
                  role="tab"
                  aria-selected={activeTab === 'notifications'}
                  aria-controls="settings-panel"
                  className={`tab-item ${activeTab === 'notifications' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notifications')}
                  style={{ textAlign: 'left', borderLeft: activeTab === 'notifications' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                >
                  {t('settingsPage.notifications')}
                </button>
                <button
                  type="button"
                  id="settings-tab-privacy"
                  role="tab"
                  aria-selected={activeTab === 'privacy'}
                  aria-controls="settings-panel"
                  className={`tab-item ${activeTab === 'privacy' ? 'active' : ''}`}
                  onClick={() => setActiveTab('privacy')}
                  style={{ textAlign: 'left', borderLeft: activeTab === 'privacy' ? '4px solid var(--primary)' : '4px solid transparent', borderBottom: 'none' }}
                >
                  {t('settingsPage.privacy')}
                </button>
              </div>
            </div>
          </div>

          <div
            className="card settings-content-card"
            id="settings-panel"
            role="tabpanel"
            aria-labelledby={`settings-tab-${activeTab}`}
          >
            <div className="card-header">
              <h3 style={{ margin: 0 }}>
                {activeTab === 'account' && t('settingsPage.account')}
                {activeTab === 'profile' && t('settingsPage.profilePanel')}
                {activeTab === 'verification' && t('settingsPage.documents')}
                {activeTab === 'notifications' && t('settingsPage.notifications')}
                {activeTab === 'privacy' && t('settingsPage.privacy')}
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
                      <label htmlFor="settings-email">{t('settingsPage.email')}</label>
                      <input id="settings-email" type="email" value={user.email || ''} disabled style={{ opacity: 0.7 }} />
                      <span className="input-hint">{t('settingsPage.emailHint')}</span>
                    </div>

                    <div className="input-group">
                      <label htmlFor="settings-display-name">{user.role === 'client' ? t('settingsPage.alias') : t('settingsPage.fullName')}</label>
                      <input
                        id="settings-display-name"
                        type="text"
                        value={form.displayName}
                        onChange={(event) => updateForm('displayName', event.target.value)}
                        placeholder={user.role === 'client' ? t('settingsPage.aliasPlaceholder') : t('settingsPage.namePlaceholder')}
                      />
                      <span className="input-hint">
                        {user.role === 'client' ? t('settingsPage.aliasHint') : t('settingsPage.nameHint')}
                      </span>
                    </div>

                    {user.role === 'client' && (
                      <div className="grid grid-2 gap-md">
                        <div className="input-group">
                          <label htmlFor="settings-emergency-name">{t('settingsPage.emergencyName')}</label>
                          <input
                            id="settings-emergency-name"
                            type="text"
                            value={form.emergencyName}
                            onChange={(event) => updateForm('emergencyName', event.target.value)}
                            placeholder={t('settingsPage.emergencyNamePlaceholder')}
                          />
                        </div>
                        <div className="input-group">
                          <label htmlFor="settings-emergency-phone">{t('settingsPage.emergencyPhone')}</label>
                          <input
                            id="settings-emergency-phone"
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
                        <label htmlFor="settings-profile-name">{t('settingsPage.profileName')}</label>
                        <input
                          id="settings-profile-name"
                          type="text"
                          value={form.displayName}
                          onChange={(event) => updateForm('displayName', event.target.value)}
                          placeholder={t('settingsPage.profileNamePlaceholder')}
                        />
                      </div>
                      <div className="input-group">
                        <label htmlFor="settings-profile-title">{t('settingsPage.titleLabel')}</label>
                        <input
                          id="settings-profile-title"
                          type="text"
                          value={form.psychologistProfile.title}
                          onChange={(event) => updatePsychologistForm('title', event.target.value)}
                          placeholder={t('settingsPage.titlePlaceholder')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-2 gap-md">
                      <div className="input-group">
                        <label htmlFor="settings-profile-experience">{t('settingsPage.experience')}</label>
                        <input
                          id="settings-profile-experience"
                          type="number"
                          min="0"
                          value={form.psychologistProfile.experience}
                          onChange={(event) => updatePsychologistForm('experience', event.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label htmlFor="settings-profile-price">{t('settingsPage.fee')}</label>
                        <input
                          id="settings-profile-price"
                          type="number"
                          min="0"
                          step="50"
                          value={form.psychologistProfile.basePrice}
                          onChange={(event) => updatePsychologistForm('basePrice', event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label htmlFor="settings-profile-short-bio">{t('settingsPage.shortBio')}</label>
                      <input
                        id="settings-profile-short-bio"
                        type="text"
                        maxLength="160"
                        value={form.psychologistProfile.shortBio}
                        onChange={(event) => updatePsychologistForm('shortBio', event.target.value)}
                        placeholder={t('settingsPage.shortBioPlaceholder')}
                      />
                      <span className="input-hint">{form.psychologistProfile.shortBio.length}/160 {t('settingsPage.characters')}</span>
                    </div>

                    <div className="input-group">
                      <label htmlFor="settings-profile-bio">{t('settingsPage.bio')}</label>
                      <textarea
                        id="settings-profile-bio"
                        rows="5"
                        value={form.psychologistProfile.bio}
                        onChange={(event) => updatePsychologistForm('bio', event.target.value)}
                        placeholder={t('settingsPage.bioPlaceholder')}
                      />
                    </div>

                    <div className="input-group" role="group" aria-labelledby="settings-specializations-label">
                      <span className="settings-field-label" id="settings-specializations-label">{t('settingsPage.specializations')}</span>
                      <div className="filter-tags">
                        {SPECIALIZATIONS.map(spec => (
                          <button
                            key={spec.id}
                            type="button"
                            className={`tag ${form.psychologistProfile.specializations.includes(spec.id) ? 'active' : ''}`}
                            aria-pressed={form.psychologistProfile.specializations.includes(spec.id)}
                            onClick={() => togglePsychologistListItem('specializations', spec.id)}
                          >
                            {spec.icon} {t(`specializations.${spec.id}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="input-group" role="group" aria-labelledby="settings-approaches-label">
                      <span className="settings-field-label" id="settings-approaches-label">{t('settingsPage.approaches')}</span>
                      <div className="filter-tags">
                        {APPROACHES.map(approach => (
                          <button
                            key={approach.id}
                            type="button"
                            className={`tag ${form.psychologistProfile.approaches.includes(approach.id) ? 'active' : ''}`}
                            aria-pressed={form.psychologistProfile.approaches.includes(approach.id)}
                            onClick={() => togglePsychologistListItem('approaches', approach.id)}
                          >
                            {t(`approaches.${approach.id}`)[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="input-group" role="group" aria-labelledby="settings-channels-label">
                      <span className="settings-field-label" id="settings-channels-label">{t('settingsPage.channels')}</span>
                      <div className="grid grid-3 gap-sm">
                        {EDITABLE_CHANNELS.map(channel => (
                          <button
                            key={channel.id}
                            type="button"
                            className={`btn ${form.psychologistProfile.channels.includes(channel.id) ? 'btn-primary' : 'btn-ghost'}`}
                            aria-pressed={form.psychologistProfile.channels.includes(channel.id)}
                            onClick={() => togglePsychologistListItem('channels', channel.id)}
                            style={{ border: '1px solid var(--border-light)' }}
                          >
                            {channel.icon} {t(`channels.${channel.id}`)[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-2 gap-md">
                      <div className="input-group">
                        <label htmlFor="settings-profile-languages">{t('settingsPage.languages')}</label>
                        <input
                          id="settings-profile-languages"
                          type="text"
                          value={form.psychologistProfile.languagesText}
                          onChange={(event) => updatePsychologistForm('languagesText', event.target.value)}
                          placeholder={t('settingsPage.languagesPlaceholder')}
                        />
                      </div>
                      <div className="input-group">
                        <label htmlFor="settings-profile-university">{t('settingsPage.university')}</label>
                        <input
                          id="settings-profile-university"
                          type="text"
                          value={form.psychologistProfile.university}
                          onChange={(event) => updatePsychologistForm('university', event.target.value)}
                          placeholder={t('settingsPage.universityPlaceholder')}
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label htmlFor="settings-profile-supervisor">{t('settingsPage.supervisor')}</label>
                      <input
                        id="settings-profile-supervisor"
                        type="text"
                        value={form.psychologistProfile.supervisor}
                        onChange={(event) => updatePsychologistForm('supervisor', event.target.value)}
                        placeholder={t('settingsPage.supervisorPlaceholder')}
                      />
                    </div>

                    <div className="input-group" role="group" aria-labelledby="settings-availability-label">
                      <span className="settings-field-label" id="settings-availability-label">{t('settingsPage.availability')}</span>
                      <div className="grid grid-2 gap-md">
                        {DAYS_TR.map((day, index) => (
                          <div key={day} className="input-group">
                            <label htmlFor={`settings-availability-${day}`}>{t('settingsPage.weekdays')[index]}</label>
                            <input
                              id={`settings-availability-${day}`}
                              type="text"
                              value={form.psychologistProfile.availability[day] || ''}
                              onChange={(event) => updateAvailability(day, event.target.value)}
                              placeholder={t('settingsPage.availabilityPlaceholder')}
                            />
                          </div>
                        ))}
                      </div>
                      <span className="input-hint">{t('settingsPage.availabilityHint')}</span>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="grid gap-lg">
                    <div className="input-group">
                      <span className="settings-field-label">{t('settingsPage.inApp')}</span>
                      <span className="input-hint">{t('settingsPage.inAppHint')}</span>
                    </div>

                    {IS_DEMO_MODE && (
                      <p className="settings-demo-note">
                        {t('settingsPage.demoEmailNote')}
                      </p>
                    )}

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
                        <strong>{t('settingsPage.sessionEmails')}</strong><br />
                        <span className="input-hint">{t('settingsPage.sessionEmailsHint')}</span>
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
                          <strong>{t('settingsPage.applicationEmails')}</strong><br />
                          <span className="input-hint">{t('settingsPage.applicationEmailsHint')}</span>
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
                        <strong>{t('settingsPage.accountEmails')}</strong><br />
                        <span className="input-hint">{t('settingsPage.accountEmailsHint')}</span>
                      </span>
                    </label>

                    <div style={{ padding: 'var(--space-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                      {IS_DEMO_MODE
                        ? t('settingsPage.demoEmailSummary')
                        : t('settingsPage.liveEmailSummary')}
                    </div>
                  </div>
                )}

                {activeTab === 'privacy' && (
                  <div className="grid gap-lg">
                    {IS_DEMO_MODE ? (
                      <div className="settings-demo-note">
                        {t('settingsPage.demoPasswordNote')}
                      </div>
                    ) : (
                      <div className="card p-md" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                        <h4 className="mb-sm text-primary">{t('settingsPage.password')}</h4>
                        <div className="grid grid-2 gap-md">
                          <div className="input-group">
                            <label htmlFor="settings-current-password">{t('settingsPage.currentPassword')}</label>
                            <input
                              id="settings-current-password"
                              type="password"
                              value={passwordForm.current}
                              onChange={(event) => setPasswordForm(prev => ({ ...prev, current: event.target.value }))}
                              placeholder={t('settingsPage.currentPasswordPlaceholder')}
                              autoComplete="current-password"
                            />
                          </div>
                          <div className="input-group">
                            <label htmlFor="settings-new-password">{t('settingsPage.newPassword')}</label>
                            <input
                              id="settings-new-password"
                              type="password"
                              value={passwordForm.next}
                              onChange={(event) => setPasswordForm(prev => ({ ...prev, next: event.target.value }))}
                              placeholder={t('settingsPage.minPassword')}
                              autoComplete="new-password"
                            />
                          </div>
                        </div>
                        <div className="input-group mt-md">
                          <label htmlFor="settings-confirm-password">{t('settingsPage.confirmPassword')}</label>
                          <input
                            id="settings-confirm-password"
                            type="password"
                            value={passwordForm.confirm}
                            onChange={(event) => setPasswordForm(prev => ({ ...prev, confirm: event.target.value }))}
                            placeholder={t('settingsPage.confirmPasswordPlaceholder')}
                            autoComplete="new-password"
                          />
                        </div>
                        <button type="button" className="btn btn-outline btn-sm mt-md" onClick={handlePasswordUpdate}>
                          {t('settingsPage.updatePassword')}
                        </button>
                      </div>
                    )}

                    <div className="card p-md" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                      <h4 className="mb-md text-primary">{t('settingsPage.privacyPreferences')}</h4>

                      <div className="input-group mb-lg" role="group" aria-labelledby="settings-default-channel-label">
                        <span className="settings-field-label" id="settings-default-channel-label">{t('settingsPage.defaultChannel')}</span>
                        <div className="grid grid-3 gap-sm">
                          <button type="button" aria-pressed={form.channel === 'video-blur'} className={`btn ${form.channel === 'video-blur' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => updateForm('channel', 'video-blur')} style={{ border: '1px solid var(--border-light)' }}>{t('settingsPage.video')}</button>
                          <button type="button" aria-pressed={form.channel === 'voice'} className={`btn ${form.channel === 'voice' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => updateForm('channel', 'voice')} style={{ border: '1px solid var(--border-light)' }}>{t('settingsPage.voice')}</button>
                          <button type="button" aria-pressed={form.channel === 'text'} className={`btn ${form.channel === 'text' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => updateForm('channel', 'text')} style={{ border: '1px solid var(--border-light)' }}>{t('settingsPage.text')}</button>
                        </div>
                      </div>

                      <div className="input-group">
                        <label htmlFor="settings-privacy-level">{t('settingsPage.privacyLevel', { level: form.privacyLevel })}</label>
                        <input
                          id="settings-privacy-level"
                          type="range"
                          min="1"
                          max="5"
                          value={form.privacyLevel}
                          onChange={(event) => updateForm('privacyLevel', Number(event.target.value))}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          <span>{t('settingsPage.openCommunication')}</span>
                          <span>{t('settingsPage.maximumPrivacy')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="card p-md mt-md" style={{ background: 'rgba(255, 82, 82, 0.05)', border: '1px solid var(--danger)' }}>
                      <h4 className="mb-sm text-danger">{IS_DEMO_MODE ? t('settingsPage.demoData') : t('settingsPage.dangerZone')}</h4>
                      {IS_DEMO_MODE ? (
                        <p className="text-sm m-0">
                          {t('settingsPage.demoDataBody')}
                        </p>
                      ) : (
                        <>
                          <p className="text-sm mb-md">Hesap silme talebi destek onayıyla ilerler; ani ve geri alınamaz silme burada yapılmaz.</p>
                          <a
                            className="btn btn-danger btn-sm"
                            href={getMailto(BRAND.supportEmail, 'Hesap silme talebi')}
                            onClick={() => warning('Hesap Silme', 'Talebinizi tamamlamak için destek ekibine e-posta gönderin.')}
                          >
                            Hesap Silme Talebi
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="divider"></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setForm(getInitialSettings(user))}>{t('settingsPage.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    {isSaving ? t('settingsPage.saving') : t('settingsPage.save')}
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
