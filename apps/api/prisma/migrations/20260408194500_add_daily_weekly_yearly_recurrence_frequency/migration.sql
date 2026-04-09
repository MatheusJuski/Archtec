-- AlterEnum
DO $$
BEGIN
  ALTER TYPE "RecurrenceFrequency" ADD VALUE IF NOT EXISTS 'DAILY';
  ALTER TYPE "RecurrenceFrequency" ADD VALUE IF NOT EXISTS 'WEEKLY';
  ALTER TYPE "RecurrenceFrequency" ADD VALUE IF NOT EXISTS 'YEARLY';
END $$;
