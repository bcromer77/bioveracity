-- Triage only. Run on an authorised snapshot/read replica with a read-only role.
-- NOT executed against production. Flags require source review; no automatic repair.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT c.id, c.status, c."verificationMethod", c."normalisedRecordType",
       c."normalisedRecordId",
       (c."verificationMethod" IN ('DETERMINISTIC_IDENTIFIER', 'DETERMINISTIC_SOURCE')) AS legacy_verification,
       (NULLIF(c."rawObservation"->>'event_date', '') IS NULL
        AND NULLIF(c."rawObservation"->>'eventDate', '') IS NULL) AS no_explicit_event_date,
       (c."publishedAt" IS NOT NULL OR c."retrievedAt" IS NOT NULL) AS has_document_timestamps,
       (e.date = c."publishedAt" OR e.date = c."retrievedAt") AS event_equals_document_timestamp,
       e."datePrecision"
FROM "ObservationCandidate" c
LEFT JOIN "Event" e ON c."normalisedRecordType" = 'Event' AND c."normalisedRecordId" = e.id
WHERE c."verificationMethod" IN ('DETERMINISTIC_IDENTIFIER', 'DETERMINISTIC_SOURCE')
   OR (c.status IN ('VERIFIED','NORMALISED','PUBLISHED')
       AND NULLIF(c."rawObservation"->>'event_date', '') IS NULL
       AND NULLIF(c."rawObservation"->>'eventDate', '') IS NULL)
ORDER BY c.id LIMIT 500;

SELECT value, COUNT(DISTINCT "assetId") AS assets,
       COUNT(DISTINCT authority) AS authorities,
       COUNT(DISTINCT "identifierType") AS namespaces
FROM "AssetIdentifier" WHERE verified = true GROUP BY value
HAVING COUNT(DISTINCT "assetId") > 1 OR COUNT(DISTINCT authority) > 1
    OR COUNT(DISTINCT "identifierType") > 1
ORDER BY value LIMIT 500;

SELECT aa."aliasNormalized", a.jurisdiction, COUNT(DISTINCT aa."assetId") AS assets
FROM "AssetAlias" aa JOIN "Asset" a ON a.id = aa."assetId"
WHERE aa."verificationState" = 'VERIFIED'
GROUP BY aa."aliasNormalized", a.jurisdiction
HAVING COUNT(DISTINCT aa."assetId") > 1
ORDER BY aa."aliasNormalized" LIMIT 500;
ROLLBACK;
