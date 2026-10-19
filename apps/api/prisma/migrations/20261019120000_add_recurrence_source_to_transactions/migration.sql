-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "recurrenceSourceId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_recurrenceSourceId_idx" ON "transactions"("recurrenceSourceId");

-- Backfill: cópias geradas antes desta coluna apontam para a ocorrência mais antiga com os mesmos dados
UPDATE "transactions" AS t
SET "recurrenceSourceId" = g.root
FROM (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY "userId", type, category, amount, COALESCE(description, ''), "recurrenceFrequency"
      ORDER BY "occurredAt", "createdAt"
    ) AS root
  FROM "transactions"
  WHERE "isRecurring" = true
) AS g
WHERE t.id = g.id
  AND g.root <> t.id;
