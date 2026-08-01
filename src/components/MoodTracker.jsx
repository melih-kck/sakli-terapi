import './MoodTracker.css';
import { useLanguage } from '../context/LanguageContext';

const MOODS = [
  { value: 1, emoji: '😢' },
  { value: 2, emoji: '😞' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

export default function MoodTracker({ value, onChange, history = [], size = 'md' }) {
  const { language, t } = useLanguage();
  const moodLabels = t('moods');

  return (
    <div className={`mood-tracker mood-tracker-${size}`}>
      <div className="mood-options">
        {MOODS.map((mood, index) => (
          <button
            key={mood.value}
            type="button"
            className={`mood-option ${value === mood.value ? 'selected' : ''}`}
            aria-pressed={value === mood.value}
            onClick={() => onChange && onChange(mood.value)}
            title={moodLabels[index]}
            id={`mood-${mood.value}`}
          >
            <span className="mood-emoji">{mood.emoji}</span>
            <span className="mood-label">{moodLabels[index]}</span>
          </button>
        ))}
      </div>
      {history.length > 0 && (
        <div className="mood-chart">
          <div className="mood-chart-bars">
            {history.slice(-7).map((entry, i) => (
              <div key={i} className="mood-bar-wrapper">
                <div
                  className="mood-bar"
                  style={{ height: `${(entry.mood / 5) * 100}%` }}
                  title={`${entry.date}: ${MOODS[entry.mood - 1]?.emoji}`}
                >
                  <span className="mood-bar-emoji">{MOODS[entry.mood - 1]?.emoji}</span>
                </div>
                <span className="mood-bar-day">
                  {new Date(entry.date).toLocaleDateString(language === 'en' ? 'en-US' : 'tr-TR', { weekday: 'short' }).slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
