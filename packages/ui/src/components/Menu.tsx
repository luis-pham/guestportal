import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';

export type MenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  onSelect?: () => void;
};

export type MenuProps = {
  label: string;
  items: MenuItem[];
  children?: ReactNode;
};

export function Menu({ label, items }: MenuProps) {
  const [open, setOpen] = useState(false);
  const buttonId = useId();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="gp-menu" ref={rootRef}>
      <Button
        id={buttonId}
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      {open ? (
        <ul id={menuId} className="gp-menu__list" role="menu" aria-labelledby={buttonId}>
          {items.map((item, index) => (
            <li key={item.id} role="none">
              <button
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                className="gp-menu__item"
                role="menuitem"
                tabIndex={0}
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect?.();
                  setOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    itemRefs.current[(index + 1) % items.length]?.focus();
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    itemRefs.current[(index - 1 + items.length) % items.length]?.focus();
                  }
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
