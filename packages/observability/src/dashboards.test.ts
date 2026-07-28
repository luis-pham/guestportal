import { describe, expect, it } from 'vitest';
import { DEFAULT_ALERT_RULES } from './alerts.js';
import { DEFAULT_DASHBOARD_PANELS, validateDashboardCoverage } from './dashboards.js';

describe('dashboard checks', () => {
  it('covers every alert metric in the default operator dashboard', () => {
    const result = validateDashboardCoverage();

    expect(result).toEqual({
      passed: true,
      missingMetrics: [],
      alertsWithoutRunbook: [],
    });
  });

  it('reports missing panels and missing runbooks', () => {
    const result = validateDashboardCoverage(
      [{ ...DEFAULT_ALERT_RULES[0]!, runbook: '' }],
      DEFAULT_DASHBOARD_PANELS.filter((panel) => panel.metric !== 'availability'),
    );

    expect(result.passed).toBe(false);
    expect(result.missingMetrics).toEqual(['availability']);
    expect(result.alertsWithoutRunbook).toEqual(['api.availability.down']);
  });
});
