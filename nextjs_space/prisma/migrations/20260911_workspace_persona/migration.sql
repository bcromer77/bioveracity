-- Additive, backward-compatible: persist the workspace persona preset so it no longer
-- depends on a URL query parameter. Existing rows default to the neutral 'custom' preset.
ALTER TABLE "PrivateWorkspace" ADD COLUMN IF NOT EXISTS "persona" TEXT NOT NULL DEFAULT 'custom';
