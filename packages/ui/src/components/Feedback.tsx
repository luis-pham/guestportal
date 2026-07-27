import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from '../lib/cn';

export type LoadingProps = {
  label?: string;
};

export function Loading({ label = 'Loading' }: LoadingProps) {
  return (
    <div className="gp-loading" role="status" aria-live="polite">
      <span className="gp-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="gp-state" data-testid="empty-state">
      <h2 className="gp-state__title">{title}</h2>
      {description ? <p className="gp-state__body">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title,
  description,
  retryLabel = 'Try again',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={cn('gp-state', 'gp-state--error')} role="alert" data-testid="error-state">
      <h2 className="gp-state__title">{title}</h2>
      {description ? <p className="gp-state__body">{description}</p> : null}
      {onRetry ? (
        <Button variant="danger" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
  'aria-label'?: string;
};

export function Skeleton({
  width = '100%',
  height = 16,
  className,
  'aria-label': ariaLabel = 'Loading placeholder',
}: SkeletonProps) {
  return (
    <span
      className={cn('gp-skeleton', className)}
      style={{ width, height }}
      role="presentation"
      aria-hidden="true"
      data-label={ariaLabel}
    />
  );
}

export type SkeletonBlockProps = {
  lines?: number;
  children?: ReactNode;
};

export function SkeletonBlock({ lines = 3 }: SkeletonBlockProps) {
  return (
    <div aria-busy="true" aria-live="polite" data-testid="skeleton-block">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} height={14} width={`${100 - index * 12}%`} />
      ))}
    </div>
  );
}
