import { schema21, type Schema21Payload } from '../../ingest/schema-2-1'
import {
  STRANGFORD_LOUGH_DAERA_RECORDS,
  type DaeraEvidenceRecord,
} from './strangford-lough'

export function toSchema21(
  records: readonly DaeraEvidenceRecord[],
  retrievalTimestamp: string,
): Schema21Payload {
  const payload = {
    ingestion_metadata: {
      source_agent: 'daera-protected-places-adapter',
      schema_version: '2.1',
      category: 'protected-area evidence',
      target_region: 'Northern Ireland',
      stream: 'review-queue',
      publication_status: 'draft',
    },
    raw_source: {
      publisher: 'Department of Agriculture, Environment and Rural Affairs',
      retrieval_timestamp: retrievalTimestamp,
      licence_note:
        'Source pages are public official records. Media and third-party rights must be checked separately.',
    },
    observations: records.map((record) => ({
      type: 'PROTECTED_AREA_RECORD',
      record_id: record.recordId,
      title: `${record.placeName} ${record.designation}`,
      claim: record.claim,
      supporting_passage: record.supportingPassage,
      passage_kind: record.passageKind,
      evidence_type: record.evidenceType,
      source_url: record.sourceUrl,
      publisher: record.publisher,
      jurisdiction: record.jurisdiction,
      publication_timestamp: record.publicationDate,
      publication_date_precision: record.publicationDatePrecision,
      retrieval_timestamp: retrievalTimestamp,
      asset_name: record.placeName,
      asset_slug: record.placeSlug,
      designation: record.designation,
      review_status: 'human-review-required',
      public_publish_allowed: false,
    })),
    analysis: {
      interpretation:
        'Protected-area context for a place page. It is not evidence about a nearby business and does not establish environmental performance.',
      limitations: [
        'DAERA source pages do not display publication dates.',
        'The records do not amount to DAERA approval, certification or endorsement of a business.',
        'A reviewer must confirm currency, relevance and media rights before public use.',
      ],
    },
    commercial: {
      badge_eligibility: 'not-assessed',
      regulator_endorsement: false,
    },
  }

  return schema21.parse(payload)
}

export function buildStrangfordLoughSeed(retrievalTimestamp: string): Schema21Payload {
  return toSchema21(STRANGFORD_LOUGH_DAERA_RECORDS, retrievalTimestamp)
}
