-- AlterTable
ALTER TABLE "events" ADD COLUMN     "description" TEXT,
ADD COLUMN     "noteId" TEXT;

-- CreateIndex
CREATE INDEX "events_noteId_idx" ON "events"("noteId");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
