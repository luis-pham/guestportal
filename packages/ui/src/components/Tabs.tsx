import type { ReactNode } from 'react';
import { useId, useState } from 'react';

export type TabItem = {
  id: string;
  label: string;
  panel: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  defaultTabId?: string;
  'aria-label'?: string;
};

export function Tabs({ items, defaultTabId, 'aria-label': ariaLabel = 'Tabs' }: TabsProps) {
  const baseId = useId();
  const initial = defaultTabId ?? items.find((item) => !item.disabled)?.id ?? items[0]?.id;
  const [active, setActive] = useState(initial);

  return (
    <div className="gp-tabs">
      <div className="gp-tabs__list" role="tablist" aria-label={ariaLabel}>
        {items.map((item, index) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              className="gp-tabs__tab"
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => setActive(item.id)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                event.preventDefault();
                const enabled = items.filter((entry) => !entry.disabled);
                const current = enabled.findIndex((entry) => entry.id === active);
                const nextIndex =
                  event.key === 'ArrowRight'
                    ? (current + 1) % enabled.length
                    : (current - 1 + enabled.length) % enabled.length;
                const next = enabled[nextIndex];
                if (next) {
                  setActive(next.id);
                  document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
                }
              }}
              data-index={index}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <div
            key={item.id}
            id={`${baseId}-panel-${item.id}`}
            className="gp-tabs__panel"
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${item.id}`}
            hidden={!selected}
          >
            {selected ? item.panel : null}
          </div>
        );
      })}
    </div>
  );
}
