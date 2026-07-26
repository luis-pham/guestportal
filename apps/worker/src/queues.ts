/**
 * Queue names from the event/job catalog.
 * BullMQ wiring lands in later phases; Phase 00 only registers the catalog.
 */
export const QUEUE_NAMES = [
  'knowledge-ingestion',
  'embedding',
  'translation',
  'image-processing',
  'notifications',
  'analytics-rollup',
  'webhook-delivery',
  'cleanup',
  'conversation-summary',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export function getRegisteredQueues(): QueueName[] {
  return [...QUEUE_NAMES];
}
