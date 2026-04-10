-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "AccountEntryType" AS ENUM ('PAYABLE', 'RECEIVABLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "AccountEntryStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable tasks
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recurrenceFrequency" "RecurrenceFrequency";

-- AlterTable events
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recurrenceFrequency" "RecurrenceFrequency";

-- CreateTable monthly_goals
CREATE TABLE IF NOT EXISTS "monthly_goals" (
  "id" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "targetAmount" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "monthly_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable account_entries
CREATE TABLE IF NOT EXISTS "account_entries" (
  "id" TEXT NOT NULL,
  "type" "AccountEntryType" NOT NULL,
  "status" "AccountEntryStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DOUBLE PRECISION NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "account_entries_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "monthly_goals_userId_month_year_idx" ON "monthly_goals"("userId", "month", "year");
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_goals_userId_month_year_category_key" ON "monthly_goals"("userId", "month", "year", "category");
CREATE INDEX IF NOT EXISTS "account_entries_userId_dueDate_idx" ON "account_entries"("userId", "dueDate");
CREATE INDEX IF NOT EXISTS "account_entries_userId_status_idx" ON "account_entries"("userId", "status");
CREATE INDEX IF NOT EXISTS "account_entries_userId_type_idx" ON "account_entries"("userId", "type");

-- Foreign keys
DO $$
BEGIN
  ALTER TABLE "monthly_goals"
    ADD CONSTRAINT "monthly_goals_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "account_entries"
    ADD CONSTRAINT "account_entries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
