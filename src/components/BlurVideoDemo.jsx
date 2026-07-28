import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  DEFAULT_SESSION_BLUR_LEVEL,
  getSessionBlurPreset,
  normalizeSessionBlurLevel,
} from '../lib/session-privacy';
import participantImage from '../assets/demo-video-participant.webp';
import './BlurVideoDemo.css';

export default function BlurVideoDemo() {
  const { t } = useLanguage();
  const [requestedLevel, setRequestedLevel] = useState(DEFAULT_SESSION_BLUR_LEVEL);
  const [appliedLevel, setAppliedLevel] = useState(DEFAULT_SESSION_BLUR_LEVEL);
  const [lastSafeLevel, setLastSafeLevel] = useState(DEFAULT_SESSION_BLUR_LEVEL);
  const [clearVideoConsent, setClearVideoConsent] = useState(false);

  const appliedPreset = getSessionBlurPreset(appliedLevel);
  const levelLabels = t('loginPage.blurDemo.levels');
  const isClearRequested = requestedLevel === 0;

  const handleLevelChange = (event) => {
    const nextLevel = normalizeSessionBlurLevel(event.target.value);
    setRequestedLevel(nextLevel);
    setClearVideoConsent(false);

    if (nextLevel === 0) return;

    setAppliedLevel(nextLevel);
    setLastSafeLevel(nextLevel);
  };

  const handleConsentChange = (event) => {
    const isConfirmed = event.target.checked;
    setClearVideoConsent(isConfirmed);
    setAppliedLevel(isConfirmed ? 0 : lastSafeLevel);
  };

  return (
    <section className="blur-video-demo" aria-labelledby="blur-demo-title">
      <div className="blur-demo-heading">
        <span className="blur-demo-eyebrow">{t('loginPage.blurDemo.eyebrow')}</span>
        <h3 id="blur-demo-title">{t('loginPage.blurDemo.title')}</h3>
        <p>{t('loginPage.blurDemo.description')}</p>
      </div>

      <div className="blur-demo-call">
        <div className="blur-demo-stage">
          <img
            className="blur-demo-remote-image"
            src={participantImage}
            alt={t('loginPage.blurDemo.sentImageAlt')}
            style={{ filter: `blur(${appliedPreset.pixels}px)`, transform: 'scale(1.09)' }}
          />

          <div className="blur-demo-call-top" aria-hidden="true">
            <span className="blur-demo-live">
              <span className="blur-demo-live-dot" />
              {t('loginPage.blurDemo.connected')}
            </span>
            <span className="blur-demo-timer">00:18</span>
          </div>

          <div className="blur-demo-call-label">
            <span>{t('loginPage.blurDemo.sentView')}</span>
            <strong>{levelLabels[appliedLevel]}</strong>
          </div>

          <div className="blur-demo-local">
            <img src={participantImage} alt="" />
            <span>{t('loginPage.blurDemo.localPreview')}</span>
            <small>{t('loginPage.blurDemo.onlyYou')}</small>
          </div>
        </div>

        <div className="blur-demo-controls">
          <div className="blur-demo-control-row">
            <label htmlFor="demo-blur-level">{t('loginPage.blurDemo.controlLabel')}</label>
            <output htmlFor="demo-blur-level" aria-live="polite">
              {levelLabels[requestedLevel]}
            </output>
          </div>
          <input
            id="demo-blur-level"
            className="blur-demo-slider"
            type="range"
            min="0"
            max="5"
            step="1"
            value={requestedLevel}
            onChange={handleLevelChange}
            aria-valuetext={levelLabels[requestedLevel]}
            style={{ '--blur-demo-progress': `${requestedLevel * 20}%` }}
          />
          <div className="blur-demo-scale" aria-hidden="true">
            <span>{t('loginPage.blurDemo.clear')}</span>
            <span>{t('loginPage.blurDemo.maximum')}</span>
          </div>

          {isClearRequested && (
            <label className="blur-demo-consent" htmlFor="demo-clear-video-consent">
              <input
                id="demo-clear-video-consent"
                type="checkbox"
                checked={clearVideoConsent}
                onChange={handleConsentChange}
              />
              <span>
                <strong>{t('loginPage.blurDemo.consentTitle')}</strong>
                <small>{t('loginPage.blurDemo.consentDescription')}</small>
              </span>
            </label>
          )}

          <div className="blur-demo-status" role="status">
            <span className={appliedLevel === 0 ? 'is-clear' : ''} aria-hidden="true" />
            {t('loginPage.blurDemo.status', { level: levelLabels[appliedLevel] })}
          </div>
        </div>
      </div>

      <p className="blur-demo-disclaimer">{t('loginPage.blurDemo.disclaimer')}</p>
    </section>
  );
}
