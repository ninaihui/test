-- Add formations JSON to support dynamic teamCount (1-4 teams)

ALTER TABLE "activity_lineups"
  ADD COLUMN IF NOT EXISTS "formations" JSONB;
