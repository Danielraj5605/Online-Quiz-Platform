import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('UI error:', error.message, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
        <div className="max-w-md">
          <p className="num text-sm text-accent">Unexpected error</p>
          <h1 className="mt-2 text-3xl font-semibold">That didn’t go to plan.</h1>
          <p className="mt-3 text-muted">The page hit a problem it couldn’t recover from. Your saved answers are safe on the server.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => location.reload()}>Reload</Button>
            <Button variant="secondary" onClick={() => { location.href = '/'; }}>Go home</Button>
          </div>
        </div>
      </div>
    );
  }
}
