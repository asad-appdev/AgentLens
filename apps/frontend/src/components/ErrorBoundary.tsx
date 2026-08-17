import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', margin: '16px 0' }}>
          <div className="empty-icon-wrap" style={{ margin: '0 auto 12px auto' }}>
            <AlertTriangle size={32} color="#fb7185" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
            {this.props.fallbackTitle || 'Something went wrong in this panel'}
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            className="action-btn"
            onClick={this.handleRetry}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
          >
            <RefreshCw size={14} /> Retry Panel
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
