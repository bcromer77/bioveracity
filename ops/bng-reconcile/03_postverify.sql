-- BNG reconciliation — POST-MIGRATION STRUCTURAL VERIFICATION (read-only)
-- PREPARED, NOT EXECUTED. Run AFTER `prisma migrate deploy`.
-- Every check prints PASS/FAIL. Any FAIL = investigate before use.

\echo '== 1/2/3 required tables exist =='
SELECT
  bool_or(table_name='PrivateCaseEvidenceCheck')      AS evidencecheck_exists,
  bool_or(table_name='PrivateCaseObligation')          AS obligation_exists,
  bool_or(table_name='PrivateCaseObligationRevision')  AS revision_exists
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('PrivateCaseEvidenceCheck','PrivateCaseObligation','PrivateCaseObligationRevision');

\echo '== 4 composite FK: PrivateCaseObligation(workspaceId,caseId,evidenceCheckId) -> PrivateCaseEvidenceCheck(workspaceId,caseId,id) =='
SELECT conname,
       pg_get_constraintdef(oid) AS definition,
       (pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY ("workspaceId", "caseId", "evidenceCheckId") REFERENCES "PrivateCaseEvidenceCheck"("workspaceId", "caseId", id)%')
         AS case_scoped_fk_pass
FROM pg_constraint
WHERE conrelid = '"public"."PrivateCaseObligation"'::regclass
  AND contype = 'f'
  AND pg_get_constraintdef(oid) ILIKE '%PrivateCaseEvidenceCheck%';

\echo '== 4b confirm NO stray FK from evidenceCheckId to global EvidenceCheckRecord =='
SELECT count(*) AS stray_global_fk_should_be_zero
FROM pg_constraint
WHERE conrelid = '"public"."PrivateCaseObligation"'::regclass
  AND contype='f'
  AND pg_get_constraintdef(oid) ILIKE '%REFERENCES "EvidenceCheckRecord"%';

\echo '== 5 private_case_template CHECK includes BNG =='
SELECT pg_get_constraintdef(oid) AS definition,
       (pg_get_constraintdef(oid) ILIKE '%''BNG''%') AS bng_present_pass
FROM pg_constraint WHERE conname='private_case_template';

\echo '== 6 Event.datePrecision text / NOT NULL / default day =='
SELECT data_type, is_nullable, column_default,
       (data_type='text' AND is_nullable='NO' AND column_default=$$'day'::text$$) AS event_dateprecision_pass
FROM information_schema.columns
WHERE table_name='Event' AND column_name='datePrecision';

\echo '== 7 Event row count remains 29 =='
SELECT count(*)::int AS event_rows, (count(*)=29) AS event_count_pass FROM "Event";

\echo '== 8 _prisma_migrations records both new migrations (applied, not rolled back) =='
SELECT migration_name, finished_at IS NOT NULL AS applied, rolled_back_at IS NOT NULL AS rolled_back
FROM _prisma_migrations
WHERE migration_name IN ('20260923_bng_obligations','20260930_event_date_precision')
ORDER BY migration_name;
