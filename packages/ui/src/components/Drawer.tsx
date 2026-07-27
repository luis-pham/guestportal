import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

export type DrawerProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
};

export function Drawer({
  open,
  title,
  children,
  onClose,
  closeLabel = 'Close',
}: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      closeRef.current?.focus();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="gp-drawer"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} className="gp-drawer__title">
        {title}
      </h2>
      <div className="gp-drawer__body">{children}</div>
      <div className="gp-drawer__actions">
        <Button ref={closeRef} variant="secondary" onClick={onClose} data-testid="drawer-close">
          {closeLabel}
        </Button>
      </div>
    </dialog>
  );
}
