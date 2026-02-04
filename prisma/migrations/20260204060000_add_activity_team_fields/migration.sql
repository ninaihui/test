-- Add team fields to activities
ALTER TABLE "activities" ADD COLUMN "teamCount" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "activities" ADD COLUMN "teamNames" JSONB;

-- Backfill teamCount based on maxParticipants: teamCount = clamp(ceil(maxParticipants/12), 1, 4)
UPDATE "activities"
SET "teamCount" = LEAST(4, GREATEST(1, CEIL("maxParticipants" / 12.0)::int));
