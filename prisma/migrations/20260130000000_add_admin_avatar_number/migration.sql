-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "adminUserId" TEXT;

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN "number" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_number_key" ON "team_members"("teamId", "number");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
