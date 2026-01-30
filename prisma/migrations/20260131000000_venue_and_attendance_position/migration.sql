-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "activities" ADD COLUMN "venueId" TEXT;

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN "position" TEXT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
