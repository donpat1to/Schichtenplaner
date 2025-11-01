// src/components/ErrorBoundary/ErrorBoundary.tsx
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Application Error:', error);
    console.error('📋 Error Details:', errorInfo);
    
    // In production, send to your error reporting service
    // logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h2>Oops! Something went wrong</h2>
          <p style={{ margin: '20px 0', color: '#666' }}>
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          <div style={{ marginTop: '30px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Refresh Page
            </button>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ 
              marginTop: '20px', 
              textAlign: 'left',
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '4px'
            }}>
              <summary>Error Details (Development)</summary>
              <pre style={{ 
                whiteSpace: 'pre-wrap',
                fontSize: '12px',
                color: '#dc3545'
              }}>
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;