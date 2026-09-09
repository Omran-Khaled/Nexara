import { Collection, Db } from 'mongodb';
import { IngestionJob, IngestionStatus } from '../models/ingestion';
import { DatabaseError } from '../errors/ApplicationErrors';

const copy = <T>(value: T): T => structuredClone(value);

export interface IngestionRepository {
  create(job: IngestionJob): Promise<IngestionJob>;
  get(id: string): Promise<IngestionJob | null>;
  update(job: IngestionJob): Promise<IngestionJob>;
  list(status?: IngestionStatus): Promise<IngestionJob[]>;
}

export class InMemoryIngestionRepository implements IngestionRepository {
  private readonly jobs = new Map<string, IngestionJob>();
  async create(job: IngestionJob) { if (this.jobs.has(job.id)) throw new Error('DUPLICATE_INGESTION'); this.jobs.set(job.id, copy(job)); return copy(job); }
  async get(id: string) { const job = this.jobs.get(id); return job ? copy(job) : null; }
  async update(job: IngestionJob) { if (!this.jobs.has(job.id)) throw new Error('INGESTION_NOT_FOUND'); this.jobs.set(job.id, copy(job)); return copy(job); }
  async list(status?: IngestionStatus) { return [...this.jobs.values()].filter((job) => !status || job.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy); }
}

export class MongoIngestionRepository implements IngestionRepository {
  private readonly jobs: Collection<IngestionJob>;
  constructor(db: Db) { this.jobs = db.collection<IngestionJob>('ingestion_jobs'); }
  async create(job: IngestionJob) {
    try { await this.jobs.insertOne(job); return copy(job); }
    catch (error: unknown) { if ((error as { code?: number }).code === 11000) throw new Error('DUPLICATE_INGESTION'); throw new DatabaseError('Could not create ingestion job.', error); }
  }
  async get(id: string) {
    try { const job = await this.jobs.findOne({ id }, { projection: { _id: 0 } }); return job ? copy(job) : null; }
    catch (error) { throw new DatabaseError('Could not read ingestion job.', error); }
  }
  async update(job: IngestionJob) {
    try { const result = await this.jobs.replaceOne({ id: job.id }, job); if (!result.matchedCount) throw new Error('INGESTION_NOT_FOUND'); return copy(job); }
    catch (error) { if (String((error as Error)?.message) === 'INGESTION_NOT_FOUND') throw error; throw new DatabaseError('Could not update ingestion job.', error); }
  }
  async list(status?: IngestionStatus) {
    try { return await this.jobs.find(status ? { status } : {}).project({ _id: 0 }).sort({ createdAt: -1 }).toArray() as IngestionJob[]; }
    catch (error) { throw new DatabaseError('Could not list ingestion jobs.', error); }
  }
}
