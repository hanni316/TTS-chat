import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Catches render-time exceptions so a single broken view doesn't blank the
// whole app. Shows a Korean fallback with a reload button.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg-base px-6 text-center text-ink">
          <div className="text-lg font-semibold">문제가 발생했어요</div>
          <p className="max-w-xs text-sm text-ink-mute">
            잠시 후 다시 시도하거나 새로고침해 주세요.
          </p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="btn-primary"
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
