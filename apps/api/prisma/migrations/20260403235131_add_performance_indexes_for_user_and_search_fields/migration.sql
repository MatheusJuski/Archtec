-- CreateIndex
CREATE INDEX "events_userId_title_idx" ON "events"("userId", "title");

-- CreateIndex
CREATE INDEX "notes_userId_idx" ON "notes"("userId");

-- CreateIndex
CREATE INDEX "notes_userId_title_idx" ON "notes"("userId", "title");

-- CreateIndex
CREATE INDEX "notes_userId_content_idx" ON "notes"("userId", "content");

-- CreateIndex
CREATE INDEX "tasks_userId_title_idx" ON "tasks"("userId", "title");
