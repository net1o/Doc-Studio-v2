import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let display = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(display) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        display = `Firestore ${parsed.operationType || 'operation'} failed (${parsed.path || 'root'}): ${parsed.error}`;
      }
    } catch {
      // Standard error message
    }
    return {
      hasError: true,
      message: display,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f6f7f9] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border-2 border-[#111111] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 bg-[#ffee00] text-[#111111] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-base font-extrabold text-[#111111]">
                  Workspace Interrupted
                </h1>
                <p className="text-xs text-[#555a66]">
                  Local data remains safely stored in your browser.
                </p>
              </div>
            </div>

            <div className="bg-[#f8f9fb] border border-[#cbd0da] p-3 text-xs font-mono text-[#111111] break-words">
              {this.state.message}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="h-[38px] px-4 bg-[#111111] text-[#ffee00] text-xs font-bold inline-flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Resume Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-[38px] px-4 border border-[#111111] bg-white text-xs font-bold text-[#111111]"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
