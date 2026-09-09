import { randomUUID } from 'node:crypto';
import { Book } from '../../src/types';
import { ConflictError, NotFoundError, ValidationError } from '../errors/ApplicationErrors';
import { IngestionJob, IngestionProvider, IngestionSourceRecord, IngestionStageName } from '../models/ingestion';
import { IngestionRepository } from '../repositories/IngestionRepositories';
import { AuthPrincipal } from '../middleware/auth';
import { BookService } from '../services/BookService';
import { RightsService } from '../services/LibraryServices';
import { BookFileService } from '../services/BookFileService';
import { digest, fileRef, formatFor, iso, normalizedCover, slug, sourceText } from './helpers';
import { defaultStages, fail, pass, skip, stage } from './stageState';
import { buildPersistableBook, extractChapters } from './mappers';
import { assertPublishableRights, validateSourceFile } from './validators';
import { IngestionSourceGateway } from './sources';
import { IngestionPublisher } from './publisher';

/**
 * Ingestion orchestration: acquire a reviewed source record, validate it
 * against the quality gates, hold it for explicit administrator approval, and
 * only then persist a durable book + rights record and publish it.
 */
export class IngestionService {
  constructor(
    private readonly jobs: IngestionRepository,
    private readonly source: IngestionSourceGateway,
    private readonly publisher: IngestionPublisher,
    private readonly books: BookService,
    private readonly rights: RightsService,
    private readonly files?: BookFileService,
  ) {}

  async startGutenberg(externalId: string, requestedBy: string): Promise<IngestionJob> {
    return this.start('Gutenberg', externalId, requestedBy);
  }

  async startWikisource(externalId: string, languageCode: string, requestedBy: string): Promise<IngestionJob> {
    return this.start('Wikisource', externalId, requestedBy, languageCode);
  }

  async startAco(externalId: string, requestedBy: string): Promise<IngestionJob> {
    return this.start('ArabicCollectionsOnline', externalId, requestedBy);
  }

  private async start(provider: Extract<IngestionProvider, 'Gutenberg' | 'Wikisource' | 'ArabicCollectionsOnline'>, externalId: string, requestedBy: string, languageCode?: string): Promise<IngestionJob> {
    const now = iso();
    const job: IngestionJob = { id: `ingestion-${randomUUID()}`, provider, providerExternalId: externalId, requestedBy, requestedAt: now, status: 'DISCOVERED', stages: defaultStages(), createdAt: now, updatedAt: now };
    await this.jobs.create(job);
    try {
      const source = await this.acquire(job, languageCode);
      this.validateCandidate(job, source);
      job.status = 'READY_FOR_REVIEW';
      job.updatedAt = iso();
      return this.jobs.update(job);
    } catch (error) {
      fail(job, job.stages.find((entry) => entry.status === 'PENDING')?.name || 'DISCOVERY', error);
      job.updatedAt = iso();
      await this.jobs.update(job);
      throw error;
    }
  }

  private async acquire(job: IngestionJob, languageCode?: string): Promise<IngestionSourceRecord> {
    if (job.provider === 'Gutenberg') return this.source.acquireGutenberg(job.providerExternalId);
    if (job.provider === 'Wikisource' && this.source.acquireWikisource) return this.source.acquireWikisource(job.providerExternalId, languageCode || String(job.normalizedMetadata?.sourceLanguage || 'en'));
    if (job.provider === 'ArabicCollectionsOnline' && this.source.acquireAco) return this.source.acquireAco(job.providerExternalId);
    throw new ValidationError({ provider: 'This provider is catalog/link-only or not configured for durable import.' });
  }

  private validateCandidate(job: IngestionJob, source: IngestionSourceRecord): void {
    pass(job, 'DISCOVERY', { provider: source.provider, externalId: source.externalId, sourceUrl: source.sourceUrl });
    const candidate = buildPersistableBook(source, job.id);
    job.normalizedMetadata = { title: candidate.book.title, author: candidate.book.authorName, language: candidate.book.primaryLanguage, subjects: source.subjects, publicationYear: source.publicationYear, sourceLanguage: source.language };
    pass(job, 'METADATA_NORMALIZATION', { requiredFields: ['title', 'author', 'language', 'source'], valid: true });
    assertPublishableRights(source.rights);
    job.rights = source.rights;
    pass(job, 'RIGHTS_VERIFICATION', { rightsStatus: source.rights!.rightsStatus, verificationMethod: source.rights!.verificationMethod, territory: source.rights!.territory, permalink: source.rights!.permalink, rightsEvidenceUrl: source.rights!.rightsEvidenceUrl, verifiedAt: source.rights!.verifiedAt });
    if (!source.content) throw new ValidationError({ content: 'A verified source file is required before a candidate may enter review.' });
    pass(job, 'CONTENT_ACQUISITION', { url: source.content.sourceUrl, mimeType: source.content.mimeType, bytes: source.content.data.byteLength });
    validateSourceFile(source.content.data, source.content.mimeType);
    job.sourceFile = { url: source.content.sourceUrl, mimeType: source.content.mimeType, bytes: source.content.data.byteLength, sha256: digest(source.content.data) };
    pass(job, 'FILE_VALIDATION', { ...job.sourceFile });
    if (source.content.mimeType === 'application/pdf') {
      skip(job, 'TEXT_EXTRACTION', 'Scanned PDF retained as an approved source file; no server-side OCR is performed.');
      skip(job, 'CHAPTER_EXTRACTION', 'Chapter extraction is unavailable for a scanned PDF.');
      job.extractedChapters = 0;
    } else {
      const text = sourceText(source.content.data, source.content.mimeType);
      if (text.length < 400) throw new ValidationError({ content: 'Extracted text is too short to form a readable book.' });
      job.extractedText = { characters: text.length, sha256: digest(text) };
      pass(job, 'TEXT_EXTRACTION', job.extractedText);
      const chapters = extractChapters(text, candidate.book.title, candidate.book.titleAr, job.id);
      job.extractedChapters = chapters.length;
      pass(job, 'CHAPTER_EXTRACTION', { chapters: chapters.length, method: 'deterministic source-text segmentation' });
    }
    job.coverUrl = normalizedCover(source.coverUrl);
    pass(job, 'COVER_NORMALIZATION', { sourceCover: source.coverUrl || null, normalizedCover: job.coverUrl });
    pass(job, 'METADATA_ENRICHMENT', { categories: candidate.book.categories, themes: candidate.book.themes });
  }

  async get(id: string): Promise<IngestionJob> {
    const job = await this.jobs.get(id);
    if (!job) throw new NotFoundError('Ingestion job', id);
    return job;
  }

  list() {
    return this.jobs.list();
  }

  async publish(id: string, performedBy: string): Promise<IngestionJob> {
    const job = await this.get(id);
    if (job.status !== 'READY_FOR_REVIEW' || !job.sourceFile || !job.rights) throw new ConflictError('Only a fully validated ingestion candidate may be approved for durable storage.');
    if (!this.files) throw new ConflictError('Durable file storage is unavailable; approval and publication are blocked.');
    const required: IngestionStageName[] = ['DISCOVERY', 'METADATA_NORMALIZATION', 'RIGHTS_VERIFICATION', 'CONTENT_ACQUISITION', 'FILE_VALIDATION', 'COVER_NORMALIZATION', 'METADATA_ENRICHMENT'];
    const incomplete = required.filter((name) => stage(job, name).status !== 'PASSED');
    const textReady = stage(job, 'TEXT_EXTRACTION').status === 'PASSED' && stage(job, 'CHAPTER_EXTRACTION').status === 'PASSED';
    const pdfReady = job.sourceFile.mimeType === 'application/pdf' && stage(job, 'TEXT_EXTRACTION').status === 'SKIPPED' && stage(job, 'CHAPTER_EXTRACTION').status === 'SKIPPED';
    if (incomplete.length || (!textReady && !pdfReady)) throw new ConflictError(`Approval is blocked until required checks pass${incomplete.length ? `: ${incomplete.join(', ')}` : '.'}`);
    let source: IngestionSourceRecord;
    try {
      source = await this.acquire(job);
    } catch (error) {
      throw new ConflictError(`The source could not be re-acquired at approval time: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    assertPublishableRights(source.rights);
    if (!source.content || source.content.mimeType !== job.sourceFile.mimeType || digest(source.content.data) !== job.sourceFile.sha256) {
      throw new ConflictError('The source file changed after review. Submit a new reviewed import before persistent storage.');
    }
    const candidate = buildPersistableBook(source, job.id);
    if (source.content.mimeType !== 'application/pdf') {
      candidate.book.chapters = extractChapters(sourceText(source.content.data, source.content.mimeType), candidate.book.title, candidate.book.titleAr, job.id);
    }
    let persisted: Book | null = null;
    try {
      persisted = await this.publisher.persist(candidate);
      if (this.files) {
        const durableMimeType = source.content.mimeType.replace('; charset=utf-8', '');
        const stored = await this.files.upload({
          bookId: persisted.id,
          editionId: persisted.editions[0].id,
          format: formatFor(source.content.mimeType),
          mimeType: durableMimeType,
          body: source.content.data,
          originalName: `${slug(candidate.book.title)}.${formatFor(source.content.mimeType).toLowerCase()}`,
          sourceUrl: source.content.sourceUrl,
          downloadAllowed: true,
          readingAllowed: true,
          offlineAllowed: true,
        }, { id: performedBy, email: null, role: 'ADMIN' } as AuthPrincipal);
        persisted = await this.books.update(persisted.id, {
          editions: persisted.editions.map((edition, index) => index === 0 ? { ...edition, files: [fileRef(stored.id, stored.format, stored.mimeType, stored.sizeBytes, stored.checksum, source.content!.sourceUrl, stored.storageKey, stored.storageProvider)] } : edition),
        });
        job.sourceFile.fileId = stored.id;
        job.sourceFile.storageKey = stored.storageKey;
      }
      await this.rights.create({
        bookId: persisted.id,
        editionId: persisted.editions[0].id,
        status: candidate.rights.rightsStatus,
        licenseType: candidate.rights.licenseType,
        evidence: candidate.rights.evidence,
        verificationMethod: candidate.rights.verificationMethod,
        territory: candidate.rights.territory,
        source: candidate.rights.source,
        attribution: candidate.rights.attribution,
        sourceProvider: source.provider,
        providerExternalId: source.externalId,
        sourceUrl: source.content.sourceUrl,
        permalink: candidate.rights.permalink,
        rightsEvidenceUrl: candidate.rights.rightsEvidenceUrl,
        sourceFileSha256: job.sourceFile.sha256,
        verifiedAt: candidate.rights.verifiedAt,
      }, performedBy);
      job.candidateBookId = persisted.id;
      job.reviewedBy = performedBy;
      job.reviewedAt = iso();
      pass(job, 'PERSISTENCE', { bookId: persisted.id, fileId: job.sourceFile.fileId || null, storageKey: job.sourceFile.storageKey || null, rightsRecord: 'created', approvedBy: performedBy });
      const published = await this.books.update(persisted.id, { workflowStatus: 'PUBLISHED' });
      pass(job, 'PUBLISHING', { bookId: published.id, publishedBy: performedBy, explicitManagerApproval: true });
      job.status = 'PUBLISHED';
      job.publishedAt = iso();
      job.updatedAt = iso();
      return this.jobs.update(job);
    } catch (error) {
      if (persisted) await this.books.delete(persisted.id).catch(() => undefined);
      fail(job, 'PERSISTENCE', error);
      job.updatedAt = iso();
      await this.jobs.update(job);
      throw error;
    }
  }
}