import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from './LanguageContext';

function LanguageProbe() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <button type="button" onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}>
      {t('common.home')}
    </button>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'tr';
  });

  it('starts in Turkish and switches the document language to English', async () => {
    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    const languageButton = await screen.findByRole('button', { name: 'Ana Sayfa' });
    fireEvent.click(languageButton);

    await screen.findByRole('button', { name: 'Home' });
    expect(document.documentElement).toHaveAttribute('lang', 'en');
  });

  it('restores the previously selected language on a new mount', async () => {
    window.localStorage.setItem('sakli_terapi_language', 'en');

    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    await screen.findByRole('button', { name: 'Home' });
    await waitFor(() => expect(document.documentElement).toHaveAttribute('lang', 'en'));
  });
});
