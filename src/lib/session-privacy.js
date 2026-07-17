export const SESSION_BLUR_PRESETS = [
  { level: 0, label: 'Blursuz', pixels: 0 },
  { level: 1, label: 'Hafif', pixels: 8 },
  { level: 2, label: 'Dengeli', pixels: 12 },
  { level: 3, label: 'Güçlü', pixels: 16 },
  { level: 4, label: 'Yüksek', pixels: 22 },
  { level: 5, label: 'Maksimum', pixels: 28 },
];

export const DEFAULT_SESSION_BLUR_LEVEL = 5;

export const normalizeSessionBlurLevel = (
  level,
  fallbackLevel = DEFAULT_SESSION_BLUR_LEVEL,
) => {
  const requestedLevel = Number(level);
  return SESSION_BLUR_PRESETS.some(preset => preset.level === requestedLevel)
    ? requestedLevel
    : fallbackLevel;
};

export const getSessionBlurPreset = (level) => {
  const normalizedLevel = normalizeSessionBlurLevel(level);
  return SESSION_BLUR_PRESETS.find(preset => preset.level === normalizedLevel);
};

export const isSessionClearVideoLevel = (level) => (
  normalizeSessionBlurLevel(level) === 0
);
