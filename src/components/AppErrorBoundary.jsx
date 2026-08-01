import { Component } from 'react';
import { captureError } from '../lib/monitoring';

const ERROR_CONTENT = {
  tr: {
    code: 'Beklenmeyen hata',
    title: 'Bu sayfa şu anda açılamıyor',
    description: 'Ana sayfaya dönerek tekrar deneyebilirsiniz.',
    action: 'Ana sayfaya dön',
  },
  en: {
    code: 'Unexpected error',
    title: 'This page is currently unavailable',
    description: 'Return to the home page and try again.',
    action: 'Return to home',
  },
};

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    captureError(error, { componentStack: errorInfo.componentStack });
  }

  handleRetry = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const content = document.documentElement.lang === 'en' ? ERROR_CONTENT.en : ERROR_CONTENT.tr;

    return (
      <main className="app-error-boundary">
        <div className="app-error-content">
          <span className="app-error-code">{content.code}</span>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
          <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
            {content.action}
          </button>
        </div>
      </main>
    );
  }
}
