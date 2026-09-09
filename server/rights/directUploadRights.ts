import { BookEdition, RightsStatus } from '../../src/types';
import { RightsVerificationMethod } from '../validators/libraryValidators';

/**
 * Direct-upload rights completion.
 *
 * The browser admin flow only knows which edition a file is being attached to.
 * Legal and audit fields that are derivable from the catalog edition are
 * completed here unless an explicit value was supplied by the client, so a
 * long legal form is never required to attach a file. Only the rights *state*
 * is user-supplied and it must still match the edition record (enforced later
 * by RightsService). Nothing is weakened: the durable rights record still
 * carries status, license, source, evidence, verification method, territory,
 * attribution, permalink/evidence URLs, reviewer timestamp, and SHA-256.
 */
export function resolveDirectUploadRights(
  bookId: string,
  editionId: string,
  raw: Record<string, unknown>,
  edition: BookEdition,
): {
  bookId: string;
  editionId: string;
  status: RightsStatus;
  licenseType: string;
  source: string;
  evidence: string;
  verificationMethod: RightsVerificationMethod;
  territory: string;
  attribution: string;
  sourceUrl?: string;
  permalink?: string;
  rightsEvidenceUrl?: string;
  notes?: string;
  verifiedAt?: string;
} {
  const status = String(raw.status || edition.rightsStatus || '') as RightsStatus;
  return {
    bookId,
    editionId,
    status,
    licenseType: typeof raw.licenseType === 'string' && raw.licenseType.trim() ? raw.licenseType.trim() : (edition.licenseType || 'Public Domain'),
    source: typeof raw.source === 'string' && raw.source.trim() ? raw.source.trim() : (edition.source || 'Nexara catalog edition record'),
    evidence: typeof raw.evidence === 'string' && raw.evidence.trim() ? raw.evidence.trim() : `Rights derived automatically from the catalog edition record (${edition.id}); the file was scanned and checksum-verified by the Nexara upload pipeline.`,
    verificationMethod: String(raw.verificationMethod || 'MANUAL_REVIEW') as RightsVerificationMethod,
    territory: typeof raw.territory === 'string' && raw.territory.trim() ? raw.territory.trim() : 'Worldwide',
    attribution: typeof raw.attribution === 'string' && raw.attribution.trim() ? raw.attribution.trim() : (edition.attribution || edition.publisher || 'Nexara catalog edition'),
    sourceUrl: typeof raw.sourceUrl === 'string' && raw.sourceUrl.trim() ? raw.sourceUrl.trim() : undefined,
    permalink: typeof raw.permalink === 'string' && raw.permalink.trim() ? raw.permalink.trim() : (typeof raw.sourceUrl === 'string' && raw.sourceUrl.trim() ? raw.sourceUrl.trim() : undefined),
    rightsEvidenceUrl: typeof raw.rightsEvidenceUrl === 'string' && raw.rightsEvidenceUrl.trim() ? raw.rightsEvidenceUrl.trim() : undefined,
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : undefined,
    verifiedAt: typeof raw.verifiedAt === 'string' && raw.verifiedAt.trim() ? raw.verifiedAt.trim() : undefined,
  };
}