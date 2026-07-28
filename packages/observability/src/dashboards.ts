import type { AlertMetric, AlertRule } from './alerts.js';
import { DEFAULT_ALERT_RULES } from './alerts.js';

export type DashboardPanel = {
  id: string;
  title: string;
  metric: AlertMetric;
  owner: 'api' | 'worker' | 'database' | 'storage' | 'ai' | 'tenant';
};

export type DashboardCheck = {
  passed: boolean;
  missingMetrics: AlertMetric[];
  alertsWithoutRunbook: string[];
};

export const DEFAULT_DASHBOARD_PANELS: DashboardPanel[] = [
  { id: 'availability', title: 'Availability', metric: 'availability', owner: 'api' },
  { id: 'api-error-rate', title: 'API Error Rate', metric: 'api_error_rate', owner: 'api' },
  { id: 'api-p95-latency', title: 'API P95 Latency', metric: 'api_p95_latency_ms', owner: 'api' },
  {
    id: 'db-connections',
    title: 'Database Connections',
    metric: 'db_connections_used_ratio',
    owner: 'database',
  },
  { id: 'queue-backlog', title: 'Queue Backlog', metric: 'queue_backlog', owner: 'worker' },
  {
    id: 'queue-failures',
    title: 'Queue Failed Jobs',
    metric: 'queue_failed_jobs',
    owner: 'worker',
  },
  {
    id: 'realtime-errors',
    title: 'Realtime Errors',
    metric: 'websocket_connection_errors',
    owner: 'api',
  },
  { id: 'rag-no-result', title: 'RAG No Result Rate', metric: 'rag_no_result_rate', owner: 'ai' },
  { id: 'rag-latency', title: 'RAG P95 Latency', metric: 'rag_p95_latency_ms', owner: 'ai' },
  {
    id: 'voice-success',
    title: 'Voice Session Success',
    metric: 'voice_session_success_rate',
    owner: 'ai',
  },
  { id: 'r2-errors', title: 'R2 Error Rate', metric: 'r2_error_rate', owner: 'storage' },
  {
    id: 'tenant-anomaly',
    title: 'Tenant Anomaly',
    metric: 'tenant_anomaly_score',
    owner: 'tenant',
  },
];

export function validateDashboardCoverage(
  rules: AlertRule[] = DEFAULT_ALERT_RULES,
  panels: DashboardPanel[] = DEFAULT_DASHBOARD_PANELS,
): DashboardCheck {
  const panelMetrics = new Set(panels.map((panel) => panel.metric));
  const requiredMetrics = new Set(rules.map((rule) => rule.metric));
  const missingMetrics = [...requiredMetrics].filter((metric) => !panelMetrics.has(metric));
  const alertsWithoutRunbook = rules
    .filter((rule) => rule.runbook.trim().length === 0)
    .map((rule) => rule.id);

  return {
    passed: missingMetrics.length === 0 && alertsWithoutRunbook.length === 0,
    missingMetrics,
    alertsWithoutRunbook,
  };
}
