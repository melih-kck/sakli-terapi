import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider } from '../context/LanguageContext';
import BlurVideoDemo from './BlurVideoDemo';

const renderDemo = () => render(
  <LanguageProvider>
    <BlurVideoDemo />
  </LanguageProvider>,
);

describe('BlurVideoDemo', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps the last safe blur until clear-video consent is given', async () => {
    renderDemo();

    const sentImage = await screen.findByAltText('Karşı tarafa gönderilen kurgusal görüşme görüntüsü');
    const slider = screen.getByLabelText('Görüntü gizliliği');

    expect(sentImage).toHaveStyle({ filter: 'blur(28px)' });
    expect(sentImage).toHaveStyle({ transform: 'scale(1.05)' });

    fireEvent.change(slider, { target: { value: '0' } });

    const consent = screen.getByRole('checkbox', {
      name: /Blursuz görüntüyü paylaşmayı onaylıyorum/,
    });
    expect(sentImage).toHaveStyle({ filter: 'blur(28px)' });
    expect(screen.getByText(/Karşı taraf şu anda/)).toHaveTextContent('Maksimum');

    fireEvent.click(consent);

    expect(sentImage).toHaveStyle({ filter: 'blur(0px)' });
    expect(sentImage).toHaveStyle({ transform: 'scale(1)' });
    expect(screen.getByText(/Karşı taraf şu anda/)).toHaveTextContent('Blursuz');
  });

  it('renders the English experience when English is selected', async () => {
    window.localStorage.setItem('sakli_terapi_language', 'en');
    renderDemo();

    await screen.findByRole('heading', { name: 'See exactly how your video is shared' });
    expect(screen.getByText(/Your camera will not open/)).toBeInTheDocument();
  });
});
