import type { PortalConfigDocument, PortalSection, PortalSectionType } from '@guestportal/contracts';

export type PortalBuilderLabels = {
  paletteTitle: string;
  canvasTitle: string;
  inspectorTitle: string;
  addSection: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  enabled: string;
  saving: string;
  saved: string;
  saveFailed: string;
  retry: string;
  unsaved: string;
  undo: string;
  redo: string;
  emptyCanvas: string;
  selectSection: string;
  sectionTypes: Record<PortalSectionType, string>;
};

export type PortalBuilderProps = {
  config: PortalConfigDocument;
  labels: PortalBuilderLabels;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string | null) => void;
  onAddSection: (type: PortalSectionType) => void;
  onReorder: (sectionId: string, direction: 'up' | 'down') => void;
  onRemoveSection: (sectionId: string) => void;
  onUpdateSection: (sectionId: string, patch: Partial<PortalSection>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRetrySave: () => void;
};
