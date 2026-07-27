import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '../lib/cn';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
  placeholder?: string;
};

export function Select({
  label,
  options,
  hint,
  error,
  placeholder,
  className,
  id,
  disabled,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="gp-field">
      <label className="gp-field__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={cn('gp-select', className)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
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
