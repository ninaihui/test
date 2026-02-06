-- Add photos table for showcase gallery

CREATE TABLE IF NOT EXISTS "photos" (
  "id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "activityId" TEXT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "photos_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "photos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "photos_createdAt_idx" ON "photos"("createdAt");
CREATE INDEX IF NOT EXISTS "photos_activityId_idx" ON "photos"("activityId");
