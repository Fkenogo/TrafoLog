import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-state">
          <AlertTriangle size={28} />
          <h1>Application error</h1>
          <p>Refresh the page. If the problem continues, check the backend service and browser console.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
