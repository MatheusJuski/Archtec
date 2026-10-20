-- CreateEnum
CREATE TYPE "CalendarSourceType" AS ENUM ('ICS_URL', 'ICS_FILE');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "allDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calendarSourceId" TEXT,
ADD COLUMN     "externalUid" TEXT,
ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "calendar_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CalendarSourceType" NOT NULL,
    "url" TEXT,
    "color" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "calendar_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_sources_userId_idx" ON "calendar_sources"("userId");

-- CreateIndex
CREATE INDEX "events_calendarSourceId_idx" ON "events"("calendarSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "events_calendarSourceId_externalUid_key" ON "events"("calendarSourceId", "externalUid");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_calendarSourceId_fkey" FOREIGN KEY ("calendarSourceId") REFERENCES "calendar_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_sources" ADD CONSTRAINT "calendar_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

