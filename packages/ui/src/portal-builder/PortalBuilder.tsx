'use client';

import type { PortalSection, PortalSectionType } from '@guestportal/contracts';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import type { PortalBuilderProps } from './types';
import './PortalBuilder.css';

const SECTION_TYPES: PortalSectionType[] = [
  'hero',
  'quick_actions',
  'explore_collections',
  'featured_services',
  'schedule',
  'guide_links',
  'promotion_banner',
  'assistant_callout',
  'contact_help',
];

function sectionPreviewTitle(section: PortalSection): string {
  if ('title' in section && section.title) {
    return section.title.en || section.title.vi || section.type;
  }
  return section.type;
}

function sectionPreviewBody(section: PortalSection): string {
  if (section.type === 'hero') return section.subtitle.en || section.subtitle.vi;
  if ('body' in section && section.body) return section.body.en || section.body.vi;
  return '';
}

export function PortalBuilder(props: PortalBuilderProps) {
  const {
    config,
    labels,
    saveState,
    dirty,
    canUndo,
    canRedo,
    selectedSectionId,
    onSelectSection,
    onAddSection,
    onReorder,
    onRemoveSection,
    onUpdateSection,
    onUndo,
    onRedo,
    onRetrySave,
  } = props;

  const selected = config.sections.find((section) => section.id === selectedSectionId) ?? null;

  return (
    <div className="gp-builder" data-testid="portal-builder">
      <div className="gp-builder__toolbar">
        <div className="gp-builder__toolbar-actions">
          <Button data-testid="builder-undo" variant="secondary" disabled={!canUndo} onClick={onUndo}>
            {labels.undo}
          </Button>
          <Button data-testid="builder-redo" variant="secondary" disabled={!canRedo} onClick={onRedo}>
            {labels.redo}
          </Button>
        </div>
        <div
          className="gp-builder__status"
          data-testid="builder-save-state"
          data-state={saveState}
        >
          {saveState === 'saving'
            ? labels.saving
            : saveState === 'saved'
              ? labels.saved
              : saveState === 'error'
                ? labels.saveFailed
                : dirty
                  ? labels.unsaved
                  : labels.saved}
          {saveState === 'error' ? (
            <Button
              data-testid="builder-retry-save"
              variant="secondary"
              onClick={onRetrySave}
              style={{ marginLeft: 8 }}
            >
              {labels.retry}
            </Button>
          ) : null}
        </div>
      </div>

      <aside className="gp-builder__panel" aria-label={labels.paletteTitle} data-testid="builder-palette">
        <h3 className="gp-builder__panel-title">{labels.paletteTitle}</h3>
        <ul className="gp-builder__palette-list">
          {SECTION_TYPES.map((type) => (
            <li key={type}>
              <Button
                className="gp-builder__palette-item"
                data-testid={`builder-add-${type}`}
                variant="secondary"
                onClick={() => onAddSection(type)}
              >
                {labels.addSection}: {labels.sectionTypes[type]}
              </Button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="gp-builder__panel" aria-label={labels.canvasTitle} data-testid="builder-canvas">
        <h3 className="gp-builder__panel-title">{labels.canvasTitle}</h3>
        {config.sections.length === 0 ? (
          <p className="gp-builder__empty" data-testid="builder-canvas-empty">
            {labels.emptyCanvas}
          </p>
        ) : (
          <div className="gp-builder__canvas">
            {config.sections.map((section, index) => (
              <article
                key={section.id}
                className="gp-builder__section"
                data-testid={`builder-section-${section.id}`}
                data-section-type={section.type}
                data-selected={selectedSectionId === section.id ? 'true' : 'false'}
                tabIndex={0}
                onClick={() => onSelectSection(section.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectSection(section.id);
                  }
                }}
              >
                <p className="gp-builder__section-type">{labels.sectionTypes[section.type]}</p>
                <h4 className="gp-builder__section-title">{sectionPreviewTitle(section)}</h4>
                {sectionPreviewBody(section) ? (
                  <p className="gp-builder__section-body">{sectionPreviewBody(section)}</p>
                ) : null}
                <div className="gp-builder__section-actions">
                  <Button
                    data-testid={`builder-move-up-${section.id}`}
                    variant="ghost"
                    disabled={index === 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onReorder(section.id, 'up');
                    }}
                  >
                    {labels.moveUp}
                  </Button>
                  <Button
                    data-testid={`builder-move-down-${section.id}`}
                    variant="ghost"
                    disabled={index === config.sections.length - 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      onReorder(section.id, 'down');
                    }}
                  >
                    {labels.moveDown}
                  </Button>
                  <Button
                    data-testid={`builder-remove-${section.id}`}
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveSection(section.id);
                    }}
                  >
                    {labels.remove}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside
        className="gp-builder__panel"
        aria-label={labels.inspectorTitle}
        data-testid="builder-inspector"
      >
        <h3 className="gp-builder__panel-title">{labels.inspectorTitle}</h3>
        {!selected ? (
          <p data-testid="builder-inspector-empty">{labels.selectSection}</p>
        ) : (
          <div className="gp-builder__inspector">
            <p data-testid="builder-inspector-type">{labels.sectionTypes[selected.type]}</p>
            <label>
              <input
                type="checkbox"
                data-testid="builder-inspector-enabled"
                checked={selected.enabled}
                onChange={(event) =>
                  onUpdateSection(selected.id, { enabled: event.target.checked } as Partial<PortalSection>)
                }
              />{' '}
              {labels.enabled}
            </label>
            {'title' in selected && selected.title ? (
              <>
                <Input
                  label="Title (EN)"
                  data-testid="builder-inspector-title-en"
                  value={selected.title.en}
                  onChange={(event) => {
                    const title = selected.title!;
                    onUpdateSection(selected.id, {
                      title: { ...title, en: event.target.value },
                    } as Partial<PortalSection>);
                  }}
                />
                <Input
                  label="Title (VI)"
                  data-testid="builder-inspector-title-vi"
                  value={selected.title.vi}
                  onChange={(event) => {
                    const title = selected.title!;
                    onUpdateSection(selected.id, {
                      title: { ...title, vi: event.target.value },
                    } as Partial<PortalSection>);
                  }}
                />
              </>
            ) : null}
            {selected.type === 'hero' ? (
              <Input
                label="Subtitle (EN)"
                data-testid="builder-inspector-subtitle-en"
                value={selected.subtitle.en}
                onChange={(event) =>
                  onUpdateSection(selected.id, {
                    subtitle: { ...selected.subtitle, en: event.target.value },
                  })
                }
              />
            ) : null}
            {'body' in selected ? (
              <Input
                label="Body (EN)"
                data-testid="builder-inspector-body-en"
                value={selected.body.en}
                onChange={(event) =>
                  onUpdateSection(selected.id, {
                    body: { ...selected.body, en: event.target.value },
                  } as Partial<PortalSection>)
                }
              />
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}
