-- Requires pgvector on the target PostgreSQL server. Apply in staging first.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "EvidenceEmbedding" (
  "reviewId" TEXT NOT NULL REFERENCES "EvidenceReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "space" TEXT NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("reviewId", "space")
);
-- Exact search first: filters and current-review joins apply before ranking.
-- Measure recall and filtered query plans before adding an approximate index.
CREATE TABLE "EvidenceSearchQuota" (
  "userId" TEXT PRIMARY KEY,
  "window" TIMESTAMP(3) NOT NULL,
  "requests" INTEGER NOT NULL
);
