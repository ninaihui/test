-- DropForeignKey: activities.teamId -> teams
ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "activities_teamId_fkey";

-- AlterTable: remove teamId from activities
ALTER TABLE "activities" DROP COLUMN IF EXISTS "teamId";

-- DropTable: team_members (references teams)
DROP TABLE IF EXISTS "team_members";

-- DropTable: teams
DROP TABLE IF EXISTS "teams";
