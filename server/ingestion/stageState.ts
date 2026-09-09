import { IngestionJob, IngestionStageName, IngestionStageRecord } from '../models/ingestion';
import { iso, STAGES } from './helpers';

/**
 * Immutable-in-place stage tracker for the ingestion job lifecycle. Each
 * mutation only ever transitions the matching named stage record.
 */

export function defaultStages(): IngestionStageRecord[] {
  return STAGES.map((name) => ({ name, status: 'PENDING' }));
}

export function stage(job: IngestionJob, name: IngestionStageName): IngestionStageRecord {
  const record = job.stages.find((entry) => entry.name === name);
  if (!record) throw new Error(`Missing ingestion stage ${name}`);
  return record;
}

export function pass(job: IngestionJob, name: IngestionStageName, evidence: Record<string, unknown> = {}, message?: string): void {
  const record = stage(job, name);
  record.status = 'PASSED';
  record.startedAt ||= iso();
  record.completedAt = iso();
  record.evidence = evidence;
  record.message = message;
}

export function skip(job: IngestionJob, name: IngestionStageName, message: string): void {
  const record = stage(job, name);
  record.status = 'SKIPPED';
  record.startedAt ||= iso();
  record.completedAt = iso();
  record.message = message;
}

export function fail(job: IngestionJob, name: IngestionStageName, error: unknown): void {
  const record = stage(job, name);
  record.status = 'FAILED';
  record.startedAt ||= iso();
  record.completedAt = iso();
  record.message = error instanceof Error ? error.message : 'Ingestion stage failed.';
  job.status = 'FAILED';
  job.failureReason = record.message;
}