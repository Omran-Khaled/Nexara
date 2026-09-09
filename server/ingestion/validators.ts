import { ValidationError } from '../errors/ApplicationErrors';
import { IngestionMimeType, RightsEvidence } from '../models/ingestion';
import { MAX_SOURCE_BYTES } from './helpers';

/**
 * Ingestion gate validators. Only verified publishable rights states and
 * structurally sound source files may enter the reviewed pipeline.
 */
export function assertPublishableRights(rights?: RightsEvidence): asserts rights is RightsEvidence {
  if (!rights || !rights.licenseType || !rights.evidence || !rights.verificationMethod || !rights.territory || !rights.source || !rights.attribution || !rights.verifiedAt || !rights.permalink || !rights.rightsEvidenceUrl) {
    throw new ValidationError({ rights: 'rightsStatus, licenseType, evidence, verificationMethod, territory, source, attribution, permalink, rightsEvidenceUrl, and verifiedAt are required.' });
  }
  if (rights.rightsStatus !== 'PUBLIC_DOMAIN' && rights.rightsStatus !== 'OPEN_ACCESS' && rights.rightsStatus !== 'LICENSED') {
    throw new ValidationError({ rightsStatus: 'Only verified publishable rights states may enter the ingestion pipeline.' });
  }
}

export function validateSourceFile(data: Buffer, mime: IngestionMimeType): void {
  if (!data.byteLength || data.byteLength > MAX_SOURCE_BYTES) throw new ValidationError({ file: 'File is empty or exceeds the 50 MB ingestion limit.' });
  if (mime === 'application/pdf') {
    if (data.length < 8 || !data.subarray(0, 5).equals(Buffer.from('%PDF-')) || !data.subarray(Math.max(0, data.length - 2048)).toString('latin1').includes('%%EOF')) {
      throw new ValidationError({ file: 'PDF source failed structural validation.' });
    }
    return;
  }
  if (data.subarray(0, Math.min(data.length, 512)).includes(0)) throw new ValidationError({ file: 'Binary content is not accepted as readable source text.' });
}