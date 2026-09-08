# Historical council collection and honeycomb retrieval

## Actual status, 8 September 2026

Implemented and tested as an isolated Python staging component. It is not wired into the Next.js website, PostgreSQL production database, or Abacus. No live embeddings have been generated: this session has no embedding credentials. Search in the existing application remains keyword-only until integration and release.

The existing hourly BioVeracity Signal Watch remains active. A separate daily ChatGPT task, BioVeracity Council Collection, was enabled in this session. It reads the council register, builds a bounded historical/current evidence collection and preserves progress in BioVeracity-council-collection.json. This is scheduled research and staging, not a running instance of this crawler and not exhaustive monitoring of 413 councils. The initial collection contains two checked excerpts (Cambridge climate report generated in 2024, Carlow minutes from May 2026), not full documents. It was imported into a scratch staging database to verify compatibility; the source collection is saved separately from GitHub. The first scheduled run has not yet been observed.

## Honeycomb implementation

A document has an identity, retained versions, source-linked chunks and distinct publication/event/retrieval dates. Typed nodes represent authorities, places, environmental assets, waterbodies, operators, events and topics. Edges require a source chunk and a proposed/reviewed status. Reviewed node filters restrict retrieval to supported relations. The code does not auto-invent physical links from names or vector similarity, and it does not implement geographic hexagon tessellation or upstream hydrology modelling.

Keyword retrieval and cosine vector retrieval combine through reciprocal-rank fusion. This is a relevance ranking, never an evidence-confidence score. Embeddings are keyed by provider/model/dimension; changing models creates a separate index. Current-version filtering prevents corrected text returning as current evidence. Access filters run before ranking. Returned passages carry source metadata, locator, section offsets, version ID and relationship status. No answer-generation model asserts facts on the user's behalf.

This first implementation uses exact vector comparison in a private SQLite store. It is suitable for staging and evaluation, not national-scale production indexing. Production should use a measured approximate-nearest-neighbour index (for example pgvector in the established PostgreSQL deployment if supported), persistent evidence storage and server-derived authorisation. The local CLI is for a trusted operator; never expose its arbitrary allowed-label argument as an unauthenticated public API. Embedding generation transfers the selected text to the configured OpenAI account; this collector is for public institutional source material, not child/private submissions.

## Collection behaviour

`councils.py` follows a reviewed list of HTTPS hosts and path patterns, checks robots access, bounds download sizes and per-run document counts, extracts HTML/PDF text, preserves retrieved bytes in the staging database and records hashes and failures. A persisted frontier resumes backfill. Incremental mode revisits indices and previously attempted documents on later UTC days. Backfill is breadth-first discovery within these bounds, with no guaranteed start date. Source-specific pagination completeness still needs live validation. HTTP errors and OCR requirements remain failed attempts, not empty successful records. No dates are inferred from URLs or retrieval times. HTML includes navigation and remains unreviewed pending a source-specific extractor.

Four configured sources: Cambridge full council plus a climate report, Peterborough full council (known 403 from web retrieval), Carlow council index, Kilkenny LCDC. This does not include all committees or all 413 councils. Cambridgeshire and CPCA source adapters are still to be inventoried. The separate scheduled researcher can discover those sources through search.

## Run in a private persistent runtime

Python 3.10+; install `collectors/requirements.txt` for PDF extraction. Standard-library-only tests do not need PDF dependencies. Use an absolute data path outside the repository, with persistent disk, restricted permissions and backups. The commands below use an example path, not an existing deployed service.

```sh
python -m unittest discover -s tests -v
python -m compileall -q collectors tests
python -m collectors.honeycomb --store /var/lib/bioveracity/councils.sqlite import /path/to/BioVeracity-council-collection.json
python -m collectors.councils --store /var/lib/bioveracity/councils.sqlite --config collectors/pilot-sources.json --mode backfill --max-documents 25
python -m collectors.councils --store /var/lib/bioveracity/councils.sqlite --config collectors/pilot-sources.json --mode incremental --max-documents 25
python -m collectors.honeycomb --store /var/lib/bioveracity/councils.sqlite index
python -m collectors.honeycomb --store /var/lib/bioveracity/councils.sqlite search 'river inundation' --vectors --authority uk:mysociety:CAB
```

Configure the three variables in `.env.example` through the runtime's secret settings. This code does not read `.env` files automatically. `index` handles at most 100 unindexed current chunks per invocation; repeat until complete. Indexing is idempotent. Without `--vectors`, search reports `lexical_only`. Missing configuration fails rather than fabricating embeddings. An embedding model's name/dimensions must be checked with the chosen account; no model availability or spend is assumed.

Embedding interface checked against: https://developers.openai.com/api/reference/python/resources/embeddings/methods/create

## Validation and remaining gates

Fourteen unit tests passed for repeat imports, document corrections, delayed historical imports, access restrictions, model-space separation, date filtering, evidence-backed relation status, invalid vectors, excerpt/full-source separation, host bounds, script removal, frontier resumption/raw preservation and failure logs. Fixtures and embeddings in tests are synthetic, not real environmental evidence or a semantic-quality evaluation. Real bootstrap excerpts were also imported successfully. Python syntax compilation passed. No TypeScript changed; no Next.js application type check or build is claimed. Live network crawler execution, production access controls, embedding-service execution and real-query retrieval quality remain unverified.

Before claiming live vector search: connect the actual Abacus/staging runtime and persistent storage; supply embedding credentials through secret settings; run a bounded backfill and embedding job; integrate authenticated search with existing assets; evaluate reviewed questions and source passages; verify deployment route and rollback. Existing app code/data remain intact. Reverting this additive branch removes the staging code; stop the separate ChatGPT task separately if needed. Do not equate a code merge with a running data pipeline.
