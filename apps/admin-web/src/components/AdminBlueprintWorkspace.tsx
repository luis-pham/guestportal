'use client';

type ModuleId =
  | 'overview'
  | 'portal'
  | 'knowledge'
  | 'catalog'
  | 'operations'
  | 'analytics'
  | 'team'
  | 'settings';

type PropertySummary = {
  id: string;
  name: string;
  slug: string;
};

type AdminBlueprintWorkspaceProps = {
  moduleId: ModuleId;
  moduleLabel: string;
  description: string;
  longFixture: string;
  sampleDate: string;
  sampleNumber: string;
  sampleCurrency: string;
  denied: boolean;
  accessDenied: string;
  noProperties: string;
  properties: PropertySummary[];
};

const moduleTracks: Record<ModuleId, string[]> = {
  overview: ['Property roster', 'Readiness', 'Publishing'],
  portal: ['Draft', 'Preview', 'Publish'],
  knowledge: ['Sources', 'Review', 'Coverage'],
  catalog: ['Categories', 'Menu', 'Availability'],
  operations: ['Requests', 'Orders', 'Escalation'],
  analytics: ['Traffic', 'Conversion', 'Revenue'],
  team: ['Members', 'Roles', 'Invites'],
  settings: ['Organization', 'Security', 'Audit'],
};

export function AdminBlueprintWorkspace({
  moduleId,
  moduleLabel,
  description,
  longFixture,
  sampleDate,
  sampleNumber,
  sampleCurrency,
  denied,
  accessDenied,
  noProperties,
  properties,
}: AdminBlueprintWorkspaceProps) {
  const tracks = moduleTracks[moduleId];
  const selectedProperty = properties[0];

  return (
    <section className="admin-blueprint" data-testid="module-workspace">
      <header className="admin-blueprint__header">
        <div>
          <p className="admin-blueprint__eyebrow">Lotavi workspace</p>
          <h2>{moduleLabel}</h2>
          <p>{description}</p>
        </div>
        <div className="admin-blueprint__header-card" aria-label="Workspace status">
          <span>Live property</span>
          <strong>{selectedProperty?.name ?? 'Select property'}</strong>
        </div>
      </header>

      <div className="admin-blueprint__metrics" aria-label="Workspace metrics">
        <article>
          <span>Properties</span>
          <strong>{properties.length}</strong>
        </article>
        <article>
          <span>Current module</span>
          <strong>{moduleLabel}</strong>
        </article>
        <article>
          <span>Locale fixture</span>
          <strong>{sampleCurrency}</strong>
        </article>
      </div>

      <div className="admin-blueprint__layout">
        <section className="admin-blueprint__panel">
          <div className="admin-blueprint__panel-head">
            <div>
              <span>Directory</span>
              <h3>Property portfolio</h3>
            </div>
            <button className="gp-btn gp-btn--secondary" type="button">
              Filter
            </button>
          </div>
          {denied ? <p data-testid="access-denied">{accessDenied}</p> : null}
          <ul className="admin-blueprint__property-list" data-testid="property-list">
            {properties.map((property) => (
              <li key={property.id}>
                <div>
                  <strong>{property.name}</strong>
                  <span>{property.slug}</span>
                </div>
                <span className="admin-blueprint__status">Ready</span>
              </li>
            ))}
          </ul>
          {!denied && properties.length === 0 ? <p>{noProperties}</p> : null}
        </section>

        <aside className="admin-blueprint__panel admin-blueprint__panel--context">
          <div className="admin-blueprint__panel-head">
            <div>
              <span>Command track</span>
              <h3>{moduleLabel}</h3>
            </div>
          </div>
          <ol className="admin-blueprint__track">
            {tracks.map((track, index) => (
              <li key={track}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{track}</strong>
              </li>
            ))}
          </ol>
          <div className="admin-blueprint__fixture">
            <p data-testid="long-fixture">{longFixture}</p>
            <p data-testid="sample-date">{sampleDate}</p>
            <p data-testid="sample-number">{sampleNumber}</p>
            <p data-testid="sample-currency">{sampleCurrency}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
