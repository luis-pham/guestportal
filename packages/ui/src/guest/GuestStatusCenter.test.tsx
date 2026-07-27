import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuestStatusCenter } from './GuestStatusCenter';

describe('GuestStatusCenter', () => {
  it('shows empty state without inventing tickets', () => {
    render(<GuestStatusCenter locale="en" items={[]} />);
    expect(screen.getByTestId('guest-status-empty').textContent).toContain('No open requests');
  });

  it('exposes retry on error and offline', () => {
    const { rerender } = render(
      <GuestStatusCenter locale="en" error="Network failed" onRetry={() => undefined} />,
    );
    expect(screen.getByTestId('guest-status-retry')).toBeTruthy();
    rerender(<GuestStatusCenter locale="en" offline onRetry={() => undefined} />);
    expect(screen.getByTestId('guest-status-offline')).toBeTruthy();
  });
});
