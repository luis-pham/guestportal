import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
};

export function StatusBadge({ children, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span className={cn('gp-status-badge', `gp-status-badge--${tone}`, className)}>{children}</span>
  );
}
