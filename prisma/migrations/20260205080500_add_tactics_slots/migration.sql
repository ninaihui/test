-- Add formations per team on Activity
ALTER TABLE "activities"
ADD COLUMN IF NOT EXISTS "teamFormations" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add slot number on Attendance (0 = bench/unassigned)
ALTER TABLE "attendances"
ADD COLUMN IF NOT EXISTS "slotNo" INTEGER NOT NULL DEFAULT 0;
