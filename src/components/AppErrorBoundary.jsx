import { Component } from 'react';
import { captureError } from '../lib/monitoring';

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

    return (
      <main className="app-error-boundary">
        <div className="app-error-content">
          <span className="app-error-code">Beklenmeyen hata</span>
          <h1>Bu sayfa şu anda açılamıyor</h1>
          <p>Ana sayfaya dönerek tekrar deneyebilirsiniz.</p>
          <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
            Ana sayfaya dön
          </button>
        </div>
      </main>
    );
  }
}
