import { describe, expect, it } from 'vitest';
import { DEFAULT_ALERT_RULES, evaluateAlertRules, type AlertRule } from './alerts.js';

describe('alert rules', () => {
  it('triggers critical operational failures at declared thresholds', () => {
    const alerts = evaluateAlertRules([
      { metric: 'availability', value: 0.98, labels: { service: 'api' } },
      { metric: 'api_error_rate', value: 0.03, labels: { service: 'api' } },
      { metric: 'queue_backlog', value: 101, labels: { queue: 'embedding' } },
      { metric: 'r2_error_rate', value: 0.02, labels: { bucket: 'assets' } },
    ]);

    expect(alerts.map((alert) => alert.rule.id)).toEqual([
      'api.availability.down',
      'api.error_rate.high',
      'queue.backlog.high',
      'r2.error_rate.high',
    ]);
    expect(
      alerts.every((alert) => alert.rule.runbook.startsWith('docs/operations/runbooks/')),
    ).toBe(true);
  });

  it('does not trigger below target thresholds', () => {
    const alerts = evaluateAlertRules([
      { metric: 'availability', value: 0.999 },
      { metric: 'api_error_rate', value: 0.001 },
      { metric: 'queue_backlog', value: 1 },
      { metric: 'voice_session_success_rate', value: 0.99 },
    ]);

    expect(alerts).toHaveLength(0);
  });

  it('keeps every default alert actionable with severity, window, and runbook', () => {
    expect(DEFAULT_ALERT_RULES.length).toBeGreaterThanOrEqual(10);
    for (const rule of DEFAULT_ALERT_RULES) {
      expect(rule.severity).toMatch(/^S[0-3]$/);
      expect(rule.window).toMatch(/^\d+(m|h)$/);
      expect(rule.runbook).toMatch(/^docs\/operations\/runbooks\/.+\.md$/);
      expect(rule.description.length).toBeGreaterThan(20);
    }
  });

  it('supports custom alert rules for deployment-specific metrics', () => {
    const rule: AlertRule = {
      id: 'custom.db.pool',
      name: 'Custom DB pool pressure',
      severity: 'S2',
      metric: 'db_connections_used_ratio',
      comparator: '>',
      threshold: 0.7,
      window: '5m',
      runbook: 'docs/operations/runbooks/db-connections.md',
      description: 'Deployment-specific database pool pressure threshold.',
    };

    expect(
      evaluateAlertRules([{ metric: 'db_connections_used_ratio', value: 0.71 }], [rule]),
    ).toHaveLength(1);
  });
});
