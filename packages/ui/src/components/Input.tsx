import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '../lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
};

export function Input({
  label,
  hint,
  error,
  trailing,
  className,
  id,
  disabled,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="gp-field">
      <label className="gp-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div style={{ display: 'grid', gap: 'var(--gp-space-6)' }}>
        <input
          id={inputId}
          className={cn('gp-input', className)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {trailing}
      </div>
      {hint && !error ? (
        <p id={hintId} className="gp-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="gp-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
