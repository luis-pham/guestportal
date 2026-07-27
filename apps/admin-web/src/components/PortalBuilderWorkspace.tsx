'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import {
  createEmptySection,
  portalConfigDocumentSchema,
  type PortalConfigDocument,
  type PortalSection,
  type PortalSectionType,
} from '@guestportal/contracts';
import { PortalBuilder, type PortalBuilderLabels } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

function propertyIdFromPath(pathname: string) {
  const match = pathname.match(/\/properties\/([^/]+)\//);
  return match?.[1] ?? '';
}

type DraftResponse = {
  propertyId: string;
  version: number;
  updatedAt: string;
  config: PortalConfigDocument;
};

export function PortalBuilderWorkspace() {
  const t = useTranslations('portalBuilder');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);

  const [config, setConfig] = useState<PortalConfigDocument | null>(null);
  const [version, setVersion] = useState(1);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<PortalConfigDocument[]>([]);
  const [future, setFuture] = useState<PortalConfigDocument[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(1);
  const pendingConfig = useRef<PortalConfigDocument | null>(null);

  const labels: PortalBuilderLabels = useMemo(
    () => ({
      paletteTitle: t('paletteTitle'),
      canvasTitle: t('canvasTitle'),
      inspectorTitle: t('inspectorTitle'),
      addSection: t('addSection'),
      moveUp: t('moveUp'),
      moveDown: t('moveDown'),
      remove: t('remove'),
      enabled: t('enabled'),
      saving: t('saving'),
      saved: t('saved'),
      saveFailed: t('saveFailed'),
      retry: t('retry'),
      unsaved: t('unsaved'),
      undo: t('undo'),
      redo: t('redo'),
      emptyCanvas: t('emptyCanvas'),
      selectSection: t('selectSection'),
      sectionTypes: {
        hero: t('types.hero'),
        quick_actions: t('types.quick_actions'),
        explore_collections: t('types.explore_collections'),
        featured_services: t('types.featured_services'),
        schedule: t('types.schedule'),
        guide_links: t('types.guide_links'),
        promotion_banner: t('types.promotion_banner'),
        assistant_callout: t('types.assistant_callout'),
        contact_help: t('types.contact_help'),
      },
    }),
    [t],
  );

  useEffect(() => {
    void (async () => {
      const me = await apiFetch('/v1/me');
      if (!me.ok) {
        router.replace(`/${locale}/login`);
        return;
      }
      const result = await apiFetch<DraftResponse>(`/v1/properties/${propertyId}/portal/draft`);
      if (!result.ok) {
        setError(t('loadError'));
        return;
      }
      setConfig(result.data.config);
      setVersion(result.data.version);
      versionRef.current = result.data.version;
      setSelectedSectionId(result.data.config.sections[0]?.id ?? null);
    })();
  }, [locale, propertyId, router, t]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  async function persist(next: PortalConfigDocument, currentVersion: number) {
    setSaveState('saving');
    pendingConfig.current = next;
    const parsed = portalConfigDocumentSchema.safeParse(next);
    if (!parsed.success) {
      setSaveState('error');
      setError(t('invalidConfig'));
      return;
    }
    const result = await apiFetch<DraftResponse>(`/v1/properties/${propertyId}/portal/draft`, {
      method: 'PUT',
      body: JSON.stringify({ version: currentVersion, config: parsed.data }),
    });
    if (!result.ok) {
      setSaveState('error');
      setError(result.status === 409 ? t('conflict') : t('saveFailed'));
      return;
    }
    versionRef.current = result.data.version;
    setVersion(result.data.version);
    setSaveState('saved');
    setDirty(false);
    setError(null);
    pendingConfig.current = null;
  }

  function scheduleSave(next: PortalConfigDocument) {
    setDirty(true);
    setSaveState('idle');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const currentVersion = versionRef.current;
    saveTimer.current = setTimeout(() => {
      void persist(next, currentVersion);
    }, 450);
  }

  function commit(next: PortalConfigDocument) {
    if (!config) return;
    setPast((prev) => [...prev.slice(-29), config]);
    setFuture([]);
    setConfig(next);
    scheduleSave(next);
  }

  function onAddSection(type: PortalSectionType) {
    if (!config) return;
    const section = createEmptySection(type);
    const next = { ...config, sections: [...config.sections, section] };
    commit(next);
    setSelectedSectionId(section.id);
  }

  function onReorder(sectionId: string, direction: 'up' | 'down') {
    if (!config) return;
    const index = config.sections.findIndex((section) => section.id === sectionId);
    if (index < 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= config.sections.length) return;
    const sections = [...config.sections];
    const [item] = sections.splice(index, 1);
    sections.splice(target, 0, item!);
    commit({ ...config, sections });
  }

  function onRemoveSection(sectionId: string) {
    if (!config) return;
    const sections = config.sections.filter((section) => section.id !== sectionId);
    commit({ ...config, sections });
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(sections[0]?.id ?? null);
    }
  }

  function onUpdateSection(sectionId: string, patch: Partial<PortalSection>) {
    if (!config) return;
    const sections = config.sections.map((section) =>
      section.id === sectionId ? ({ ...section, ...patch } as PortalSection) : section,
    );
    const next = { ...config, sections };
    const parsed = portalConfigDocumentSchema.safeParse(next);
    if (!parsed.success) {
      setError(t('invalidConfig'));
      setSaveState('error');
      return;
    }
    commit(parsed.data);
  }

  function onUndo() {
    if (!config || past.length === 0) return;
    const previous = past[past.length - 1]!;
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [config, ...prev]);
    setConfig(previous);
    scheduleSave(previous);
  }

  function onRedo() {
    if (!config || future.length === 0) return;
    const next = future[0]!;
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, config]);
    setConfig(next);
    scheduleSave(next);
  }

  if (!config && !error) {
    return <main className="gp-state">{t('loading')}</main>;
  }
  if (!config) {
    return (
      <main className="gp-state" data-testid="portal-builder-error">
        {error}
      </main>
    );
  }

  return (
    <main className="gp-state" data-testid="portal-builder-workspace">
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>
      <p data-testid="portal-builder-version">
        {t('version')}: {version}
      </p>
      {error ? (
        <p data-testid="portal-builder-error" style={{ color: 'var(--gp-color-danger)' }}>
          {error}
        </p>
      ) : null}
      <PortalBuilder
        config={config}
        labels={labels}
        saveState={saveState}
        dirty={dirty}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        selectedSectionId={selectedSectionId}
        onSelectSection={setSelectedSectionId}
        onAddSection={onAddSection}
        onReorder={onReorder}
        onRemoveSection={onRemoveSection}
        onUpdateSection={onUpdateSection}
        onUndo={onUndo}
        onRedo={onRedo}
        onRetrySave={() => {
          const next = pendingConfig.current ?? config;
          void persist(next, versionRef.current);
        }}
      />
    </main>
  );
}
