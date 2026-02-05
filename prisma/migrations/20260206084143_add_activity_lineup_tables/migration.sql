-- Add activity lineups (formation per team) + slot assignments

CREATE TABLE IF NOT EXISTS "activity_lineups" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "formationA" TEXT NOT NULL DEFAULT '4-4-2',
  "formationB" TEXT NOT NULL DEFAULT '4-4-2',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "activity_lineups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_lineups_activityId_key" UNIQUE ("activityId"),
  CONSTRAINT "activity_lineups_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "activity_lineup_slots" (
  "id" TEXT NOT NULL,
  "lineupId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "teamKey" TEXT NOT NULL,
  "slotKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "activity_lineup_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_lineup_slots_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "activity_lineups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_lineup_slots_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_lineup_slots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "activity_lineup_slots_activityId_teamKey_slotKey_key" ON "activity_lineup_slots"("activityId", "teamKey", "slotKey");
CREATE UNIQUE INDEX IF NOT EXISTS "activity_lineup_slots_activityId_teamKey_userId_key" ON "activity_lineup_slots"("activityId", "teamKey", "userId");
CREATE INDEX IF NOT EXISTS "activity_lineup_slots_activityId_teamKey_idx" ON "activity_lineup_slots"("activityId", "teamKey");
CREATE INDEX IF NOT EXISTS "activity_lineup_slots_lineupId_idx" ON "activity_lineup_slots"("lineupId");
