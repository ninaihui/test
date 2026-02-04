-- Add teamNo for team splitting (1..N). Waitlist does not participate.
ALTER TABLE "attendances" ADD COLUMN "teamNo" INTEGER;
