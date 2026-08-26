import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback 
        error={this.state.error} 
        errorInfo={this.state.errorInfo}
        onRetry={this.handleRetry}
      />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  onRetry: () => void;
}

function ErrorFallback({ error, errorInfo, onRetry }: ErrorFallbackProps) {
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className={`
      min-h-screen flex items-center justify-center p-4
      ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}
    `}>
      <div className={`
        max-w-md w-full text-center p-8 rounded-lg border
        ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
        <div className={`
          w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center
          ${isDark ? 'bg-red-500/20' : 'bg-red-50'}
        `}>
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        <h2 className={`text-xl font-semibold mb-2 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          Something went wrong
        </h2>

        <p className={`text-sm mb-6 ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}>
          An unexpected error occurred in the Analysis Manager. This might be due to a 
          temporary issue with the Airflow connection or a component malfunction.
        </p>

        {process.env.NODE_ENV === 'development' && error && (
          <details className={`
            text-left mb-6 p-3 rounded border text-xs
            ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}
          `}>
            <summary className="cursor-pointer font-medium mb-2">
              Error Details (Development)
            </summary>
            <div className="space-y-2">
              <div>
                <strong>Error:</strong> {error.message}
              </div>
              <div>
                <strong>Stack:</strong>
                <pre className="mt-1 text-xs overflow-x-auto">
                  {error.stack}
                </pre>
              </div>
              {errorInfo && (
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="mt-1 text-xs overflow-x-auto">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onRetry}
            className={`
              flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-colors duration-200
              ${isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            `}
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          <button
            onClick={() => window.location.href = '/'}
            className={`
              flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-colors duration-200
              ${isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }
            `}
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>

          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={() => {
                console.log('Error Details:', { error, errorInfo });
                alert('Error details logged to console');
              }}
              className={`
                flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                transition-colors duration-200
                ${isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }
              `}
            >
              <Bug className="w-4 h-4" />
              Debug
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Specialized error boundary for Analysis Manager components
export function AnalysisManagerErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Could send to error reporting service
        console.error('Analysis Manager Error:', error, errorInfo);
      }}
      fallback={
        <AnalysisManagerErrorFallback />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

function AnalysisManagerErrorFallback() {
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className={`
      p-8 rounded-lg border text-center
      ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      <div className={`
        w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center
        ${isDark ? 'bg-red-500/20' : 'bg-red-50'}
      `}>
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>

      <h3 className={`text-lg font-semibold mb-2 ${
        isDark ? 'text-white' : 'text-gray-900'
      }`}>
        Analysis Manager Error
      </h3>

      <p className={`text-sm mb-4 ${
        isDark ? 'text-gray-400' : 'text-gray-600'
      }`}>
        There was an error loading the Analysis Manager. This could be due to:
      </p>

      <ul className={`text-sm text-left mb-6 space-y-1 ${
        isDark ? 'text-gray-400' : 'text-gray-600'
      }`}>
        <li>• Airflow connection issues</li>
        <li>• Network connectivity problems</li>
        <li>• Temporary service unavailability</li>
      </ul>

      <button
        onClick={() => window.location.reload()}
        className={`
          flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mx-auto
          transition-colors duration-200
          ${isDark
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        <RefreshCw className="w-4 h-4" />
        Reload Page
      </button>
    </div>
  );
}