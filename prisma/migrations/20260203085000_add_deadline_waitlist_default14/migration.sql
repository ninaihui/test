-- Add deadlineAt + change default maxParticipants to 14 (including substitutes)

ALTER TABLE "activities" ADD COLUMN     "deadlineAt" TIMESTAMP(3);

-- Default capacity: 14 (incl. substitutes)
ALTER TABLE "activities" ALTER COLUMN "maxParticipants" SET DEFAULT 14;
