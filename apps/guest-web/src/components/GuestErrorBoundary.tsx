'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; onRetry?: () => void; locale?: string };
type State = { hasError: boolean };

export class GuestErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('guest_error_boundary', error.message, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      const vi = this.props.locale?.startsWith('vi');
      return (
        <main data-testid="guest-error-boundary" style={{ padding: 24, fontFamily: 'system-ui' }}>
          <h1>{vi ? 'Đã xảy ra lỗi' : 'Something went wrong'}</h1>
          <p>{vi ? 'Thử tải lại khu vực này.' : 'Try reloading this section.'}</p>
          <button
            type="button"
            data-testid="guest-error-retry"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onRetry?.();
            }}
          >
            {vi ? 'Thử lại' : 'Retry'}
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
