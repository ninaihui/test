-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "teamCount" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "activities" ADD COLUMN     "teamNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "teamNo" INTEGER NOT NULL DEFAULT 0;
