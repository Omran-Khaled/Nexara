/**
 * Compatibility façade for the reviewed book-import pipeline.
 *
 * The orchestration now lives in `server/ingestion/`, split by clear
 * responsibility (source adapters, validators, mappers, publisher, stage
 * tracking, and the orchestrator). This file preserves the stable public API
 * consumed by the runtime wiring and the test suites so no caller changes:
 *   - IngestionService
 *   - IngestionSourceGateway / GutenbergIngestionSourceGateway
 *   - IngestionPublisher / MongoIngestionPublisher
 */
export { IngestionService } from '../ingestion/service';
export { GutenbergIngestionSourceGateway } from '../ingestion/sources';
export type { IngestionSourceGateway } from '../ingestion/sources';
export { MongoIngestionPublisher } from '../ingestion/publisher';
export type { IngestionPublisher } from '../ingestion/publisher';
export type { IngestionSourceRecord, PersistableIngestionBook, RightsEvidence } from '../models/ingestion';