export type AlertSeverity = 'S0' | 'S1' | 'S2' | 'S3';

export type AlertMetric =
  | 'availability'
  | 'api_error_rate'
  | 'api_p95_latency_ms'
  | 'db_connections_used_ratio'
  | 'queue_backlog'
  | 'queue_failed_jobs'
  | 'websocket_connection_errors'
  | 'rag_no_result_rate'
  | 'rag_p95_latency_ms'
  | 'voice_session_success_rate'
  | 'r2_error_rate'
  | 'tenant_anomaly_score';

export type AlertComparator = '>' | '>=' | '<' | '<=';

export type AlertRule = {
  id: string;
  name: string;
  severity: AlertSeverity;
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: number;
  window: string;
  runbook: string;
  description: string;
};

export type MetricSample = {
  metric: AlertMetric;
  value: number;
  labels?: Record<string, string>;
};

export type TriggeredAlert = {
  rule: AlertRule;
  sample: MetricSample;
};

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'api.availability.down',
    name: 'API availability below target',
    severity: 'S1',
    metric: 'availability',
    comparator: '<',
    threshold: 0.995,
    window: '5m',
    runbook: 'docs/operations/runbooks/api-availability.md',
    description: 'Guest, Admin, Staff, or API health checks are failing.',
  },
  {
    id: 'api.error_rate.high',
    name: 'API error rate high',
    severity: 'S1',
    metric: 'api_error_rate',
    comparator: '>=',
    threshold: 0.02,
    window: '5m',
    runbook: 'docs/operations/runbooks/api-error-rate.md',
    description: 'HTTP 5xx or unhandled application errors exceed the release threshold.',
  },
  {
    id: 'api.latency.p95.high',
    name: 'API p95 latency high',
    severity: 'S2',
    metric: 'api_p95_latency_ms',
    comparator: '>=',
    threshold: 900,
    window: '10m',
    runbook: 'docs/operations/runbooks/api-latency.md',
    description: 'Core API route p95 latency is above the Phase 10 production target.',
  },
  {
    id: 'db.connections.high',
    name: 'Database connections near saturation',
    severity: 'S1',
    metric: 'db_connections_used_ratio',
    comparator: '>=',
    threshold: 0.85,
    window: '5m',
    runbook: 'docs/operations/runbooks/db-connections.md',
    description: 'PostgreSQL connection use is close to the configured maximum.',
  },
  {
    id: 'queue.backlog.high',
    name: 'Worker queue backlog high',
    severity: 'S1',
    metric: 'queue_backlog',
    comparator: '>=',
    threshold: 100,
    window: '10m',
    runbook: 'docs/operations/runbooks/queue-backlog.md',
    description: 'Knowledge or embedding jobs are not draining fast enough.',
  },
  {
    id: 'queue.failed_jobs.high',
    name: 'Worker failed jobs high',
    severity: 'S1',
    metric: 'queue_failed_jobs',
    comparator: '>=',
    threshold: 5,
    window: '10m',
    runbook: 'docs/operations/runbooks/queue-failures.md',
    description: 'Worker failures crossed the operational intervention threshold.',
  },
  {
    id: 'realtime.websocket_errors.high',
    name: 'Realtime connection errors high',
    severity: 'S2',
    metric: 'websocket_connection_errors',
    comparator: '>=',
    threshold: 10,
    window: '10m',
    runbook: 'docs/operations/runbooks/realtime-errors.md',
    description: 'Realtime reconnect or authorization errors are above the expected range.',
  },
  {
    id: 'rag.no_result.high',
    name: 'RAG no-result rate high',
    severity: 'S2',
    metric: 'rag_no_result_rate',
    comparator: '>=',
    threshold: 0.25,
    window: '30m',
    runbook: 'docs/operations/runbooks/rag-quality.md',
    description: 'Knowledge retrieval is returning no-result too often for scoped queries.',
  },
  {
    id: 'rag.latency.p95.high',
    name: 'RAG p95 latency high',
    severity: 'S2',
    metric: 'rag_p95_latency_ms',
    comparator: '>=',
    threshold: 1500,
    window: '10m',
    runbook: 'docs/operations/runbooks/rag-quality.md',
    description: 'Knowledge retrieval latency is above the guest experience target.',
  },
  {
    id: 'voice.success.low',
    name: 'Voice session success low',
    severity: 'S2',
    metric: 'voice_session_success_rate',
    comparator: '<',
    threshold: 0.9,
    window: '30m',
    runbook: 'docs/operations/runbooks/voice-live.md',
    description: 'Browser voice sessions are failing to connect or complete reliably.',
  },
  {
    id: 'r2.error_rate.high',
    name: 'R2 error rate high',
    severity: 'S1',
    metric: 'r2_error_rate',
    comparator: '>=',
    threshold: 0.01,
    window: '10m',
    runbook: 'docs/operations/runbooks/r2-storage.md',
    description: 'R2 uploads, downloads, or signed URL operations are failing.',
  },
  {
    id: 'tenant.anomaly.high',
    name: 'Tenant anomaly high',
    severity: 'S1',
    metric: 'tenant_anomaly_score',
    comparator: '>=',
    threshold: 0.8,
    window: '15m',
    runbook: 'docs/operations/runbooks/tenant-anomaly.md',
    description: 'A tenant-scoped error, traffic, or authorization anomaly needs review.',
  },
];

function compare(value: number, comparator: AlertComparator, threshold: number) {
  switch (comparator) {
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
  }
}

export function evaluateAlertRules(
  samples: MetricSample[],
  rules: AlertRule[] = DEFAULT_ALERT_RULES,
): TriggeredAlert[] {
  return rules.flatMap((rule) =>
    samples
      .filter((sample) => sample.metric === rule.metric)
      .filter((sample) => compare(sample.value, rule.comparator, rule.threshold))
      .map((sample) => ({ rule, sample })),
  );
}
