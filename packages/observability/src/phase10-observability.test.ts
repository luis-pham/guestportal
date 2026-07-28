import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ALERT_RULES, evaluateAlertRules, type AlertMetric } from './alerts.js';
import { DEFAULT_DASHBOARD_PANELS, validateDashboardCoverage } from './dashboards.js';
import { REDACTED, redactLogPayload } from './redaction.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evidenceDir = resolve(repoRoot, 'evidence/phase-10/10.4');

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')) as {
    rules?: Array<{ id: string; metric: string }>;
    panels?: Array<{ id: string; metric: string }>;
  };
}

describe('phase 10.4 observability qualification', () => {
  it('records alert, redaction, dashboard, and runbook checks', () => {
    const breachSamples = DEFAULT_ALERT_RULES.map((rule) => {
      const value =
        rule.comparator === '<' || rule.comparator === '<='
          ? rule.threshold - 0.01
          : rule.threshold + 1;
      return { metric: rule.metric, value };
    });
    const triggered = evaluateAlertRules(breachSamples);

    const redacted = redactLogPayload({
      authorization: 'Bearer live-token-value-1234567890',
      guestEmail: 'guest@example.test',
      nested: { sessionToken: 'sess_1234567890abcdef1234567890' },
      safe: 'request.failed',
    }) as {
      authorization: string;
      guestEmail: string;
      nested: { sessionToken: string };
      safe: string;
    };

    const dashboardCheck = validateDashboardCoverage();
    const infraAlerts = readJson('infra/observability/alerts.json');
    const infraDashboard = readJson('infra/observability/dashboard.json');
    const alertIds = DEFAULT_ALERT_RULES.map((rule) => rule.id).sort();
    const infraAlertIds = (infraAlerts.rules ?? []).map((rule) => rule.id).sort();
    const panelMetrics = DEFAULT_DASHBOARD_PANELS.map((panel) => panel.metric).sort();
    const infraPanelMetrics = (infraDashboard.panels ?? [])
      .map((panel) => panel.metric as AlertMetric)
      .sort();
    const missingRunbooks = DEFAULT_ALERT_RULES.map((rule) => rule.runbook).filter(
      (path) => !existsSync(resolve(repoRoot, path)),
    );

    const report = {
      generatedAt: new Date().toISOString(),
      environment: process.env.PHASE10_OBSERVABILITY_ENVIRONMENT ?? 'local',
      alertTriggerChecks: {
        expected: DEFAULT_ALERT_RULES.length,
        actual: triggered.length,
        triggeredRuleIds: triggered.map((alert) => alert.rule.id),
      },
      logRedactionChecks: {
        authorization: redacted.authorization,
        guestEmail: redacted.guestEmail,
        sessionToken: redacted.nested.sessionToken,
        safeField: redacted.safe,
      },
      dashboardCheck,
      infraChecks: {
        alertIdsMatch: JSON.stringify(alertIds) === JSON.stringify(infraAlertIds),
        panelMetricsMatch: JSON.stringify(panelMetrics) === JSON.stringify(infraPanelMetrics),
        missingRunbooks,
      },
      passed:
        triggered.length === DEFAULT_ALERT_RULES.length &&
        redacted.authorization === REDACTED &&
        redacted.guestEmail === REDACTED &&
        redacted.nested.sessionToken === REDACTED &&
        redacted.safe === 'request.failed' &&
        dashboardCheck.passed &&
        JSON.stringify(alertIds) === JSON.stringify(infraAlertIds) &&
        JSON.stringify(panelMetrics) === JSON.stringify(infraPanelMetrics) &&
        missingRunbooks.length === 0,
    };

    mkdirSync(resolve(evidenceDir, 'reports'), { recursive: true });
    writeFileSync(
      resolve(evidenceDir, 'reports/observability-checks.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );

    expect(report.passed).toBe(true);
  });
});
