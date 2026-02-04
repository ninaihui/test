-- Add isCaptain flag to users
ALTER TABLE "users" ADD COLUMN "isCaptain" BOOLEAN NOT NULL DEFAULT false;
