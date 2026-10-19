import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { RecurrenceFrequency, Transaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

// Teto de passos por série (~13 anos de ocorrências diárias)
const MAX_OCCURRENCE_STEPS = 5000;

interface RecurringSeries {
  seriesId: string;
  anchor: Date;
  head: Transaction;
}

export interface ProjectedTransaction {
  id: string;
  amount: number;
  type: Transaction['type'];
  category: string;
  categoryColor: string | null;
  description: string | null;
  isRecurring: true;
  recurrenceFrequency: RecurrenceFrequency | null;
  occurredAt: Date;
  projected: true;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private readonly materializeLocks = new Map<string, Promise<void>>();
  private readonly fallbackCategoryColors = [
    '#0f766e',
    '#f97316',
    '#1e3a8a',
    '#06b6d4',
    '#ef4444',
    '#84cc16',
    '#f59e0b',
    '#8b5cf6',
  ];

  constructor(private prisma: PrismaService) {}

  private normalizeMonthlyDate(source: Date, monthsToAdd: number) {
    const targetYear = source.getFullYear();
    const targetMonthIndex = source.getMonth() + monthsToAdd;
    const firstOfTargetMonth = new Date(targetYear, targetMonthIndex, 1);
    const lastDayOfTargetMonth = new Date(
      targetYear,
      targetMonthIndex + 1,
      0,
    ).getDate();
    const targetDay = Math.min(source.getDate(), lastDayOfTargetMonth);

    return new Date(
      firstOfTargetMonth.getFullYear(),
      firstOfTargetMonth.getMonth(),
      targetDay,
      source.getHours(),
      source.getMinutes(),
      source.getSeconds(),
      source.getMilliseconds(),
    );
  }

  /** N-ésima ocorrência contada a partir da âncora (evita deriva: 31/01 → 28/02 → 31/03). */
  private occurrenceAt(
    anchor: Date,
    recurrenceFrequency: RecurrenceFrequency,
    n: number,
  ) {
    switch (recurrenceFrequency) {
      case 'DAILY': {
        const next = new Date(anchor);
        next.setDate(next.getDate() + n);
        return next;
      }
      case 'WEEKLY': {
        const next = new Date(anchor);
        next.setDate(next.getDate() + 7 * n);
        return next;
      }
      case 'YEARLY':
        return this.normalizeMonthlyDate(anchor, 12 * n);
      case 'MONTHLY':
      default:
        return this.normalizeMonthlyDate(anchor, n);
    }
  }

  private startOfDay(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private endOfToday() {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
  }

  /**
   * Séries ativas: a ocorrência mais recente de cada série é a "cabeça".
   * Se a cabeça deixou de ser recorrente, a série parou.
   */
  private async findActiveSeries(userId?: string): Promise<RecurringSeries[]> {
    const members = await this.prisma.transaction.findMany({
      where: {
        ...(userId ? { userId } : {}),
        OR: [{ isRecurring: true }, { recurrenceSourceId: { not: null } }],
      },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    const series = new Map<string, RecurringSeries>();
    for (const tx of members) {
      const seriesId = tx.recurrenceSourceId ?? tx.id;
      const current = series.get(seriesId);
      series.set(seriesId, {
        seriesId,
        anchor: current?.anchor ?? tx.occurredAt,
        head: tx,
      });
    }

    return [...series.values()].filter(
      (s) => s.head.isRecurring && s.head.recurrenceFrequency,
    );
  }

  /** Datas da série depois do dia da cabeça e até `until`. */
  private nextOccurrences(series: RecurringSeries, until: Date) {
    const frequency = series.head.recurrenceFrequency ?? 'MONTHLY';
    const headDay = this.startOfDay(series.head.occurredAt);
    const dates: Date[] = [];

    for (let n = 1; n <= MAX_OCCURRENCE_STEPS; n += 1) {
      const date = this.occurrenceAt(series.anchor, frequency, n);
      if (date > until) break;
      if (this.startOfDay(date) > headDay) dates.push(date);
    }

    return dates;
  }

  /**
   * Cria as ocorrências que já venceram e ainda não existem. Roda sob demanda
   * (o servidor pode estar dormindo à meia-noite) e no cron diário.
   */
  materializeRecurring(userId?: string) {
    const key = userId ?? '*';
    const running = this.materializeLocks.get(key);
    if (running) return running;

    const job = this.runMaterialize(userId).finally(() =>
      this.materializeLocks.delete(key),
    );
    this.materializeLocks.set(key, job);
    return job;
  }

  private async runMaterialize(userId?: string) {
    const until = this.endOfToday();
    const series = await this.findActiveSeries(userId);

    const data = series.flatMap((s) =>
      this.nextOccurrences(s, until).map((occurredAt) => ({
        userId: s.head.userId,
        amount: s.head.amount,
        type: s.head.type,
        category: s.head.category,
        categoryColor: s.head.categoryColor,
        categoryId: s.head.categoryId,
        description: s.head.description,
        occurredAt,
        isRecurring: true,
        recurrenceFrequency: s.head.recurrenceFrequency,
        recurrenceSourceId: s.seriesId,
      })),
    );

    if (data.length === 0) return;

    await this.prisma.transaction.createMany({ data });
    this.logger.log(`Recurring transactions generated: ${data.length}`);
  }

  /** Ocorrências futuras (ainda não lançadas) dentro do intervalo, só para exibição. */
  async projectRecurring(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<ProjectedTransaction[]> {
    await this.materializeRecurring(userId);
    const series = await this.findActiveSeries(userId);
    const today = this.endOfToday();

    return series.flatMap((s) =>
      this.nextOccurrences(s, end)
        .filter((date) => date >= start && date < end && date > today)
        .map((occurredAt) => ({
          id: `projected:${s.seriesId}:${occurredAt.toISOString()}`,
          amount: s.head.amount,
          type: s.head.type,
          category: s.head.category,
          categoryColor: s.head.categoryColor,
          description: s.head.description,
          isRecurring: true,
          recurrenceFrequency: s.head.recurrenceFrequency,
          occurredAt,
          projected: true as const,
        })),
    );
  }

  @Cron('0 0 * * *')
  async processRecurringTransactions() {
    await this.materializeRecurring();
  }

  private monthRange(month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();
    return {
      targetMonth,
      targetYear,
      startDate: new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0),
      endDate: new Date(targetYear, targetMonth, 1, 0, 0, 0, 0),
    };
  }

  async projected(userId: string, month?: number, year?: number) {
    const { startDate, endDate } = this.monthRange(month, year);
    return this.projectRecurring(userId, startDate, endDate);
  }

  async summary(userId: string, month?: number, year?: number) {
    const { targetMonth, targetYear, startDate, endDate } = this.monthRange(
      month,
      year,
    );

    await this.materializeRecurring(userId);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        occurredAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const income = grouped.find((g) => g.type === 'INCOME')?._sum.amount ?? 0;
    const expense = grouped.find((g) => g.type === 'EXPENSE')?._sum.amount ?? 0;

    return {
      month: targetMonth,
      year: targetYear,
      income,
      expense,
      balance: income - expense,
    };
  }

  async expensesByCategory(userId: string, month?: number, year?: number) {
    const { targetMonth, targetYear, startDate, endDate } = this.monthRange(
      month,
      year,
    );

    // Já materializa a série; inclui as despesas recorrentes previstas no mês
    const projected = (
      await this.projectRecurring(userId, startDate, endDate)
    ).filter((tx) => tx.type === 'EXPENSE');

    const realGrouped = await this.prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId,
        type: 'EXPENSE',
        occurredAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const totals = new Map<string, number>();
    for (const item of realGrouped) {
      totals.set(item.category, item._sum.amount ?? 0);
    }
    for (const tx of projected) {
      totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount);
    }
    const grouped = [...totals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const categories = grouped.map((item) => item.category);
    const latestCategoryColors = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        category: {
          in: categories,
        },
      },
      select: {
        category: true,
        categoryColor: true,
        occurredAt: true,
      },
      orderBy: {
        occurredAt: 'desc',
      },
    });

    const colorMap = new Map<string, string>();
    for (const item of latestCategoryColors) {
      if (!colorMap.has(item.category) && item.categoryColor) {
        colorMap.set(item.category, item.categoryColor);
      }
    }

    const data = grouped.map((item, index) => ({
      category: item.category,
      amount: item.amount,
      color:
        colorMap.get(item.category) ??
        this.fallbackCategoryColors[index % this.fallbackCategoryColors.length],
    }));

    return {
      month: targetMonth,
      year: targetYear,
      total: data.reduce((sum, item) => sum + item.amount, 0),
      items: data,
    };
  }

  async findAll(userId: string) {
    await this.materializeRecurring(userId);

    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  create(userId: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        userId,
        amount: dto.amount,
        type: dto.type,
        category: dto.category.trim(),
        categoryColor: dto.categoryColor ?? null,
        description: dto.description?.trim() || null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        isRecurring: dto.isRecurring ?? false,
        recurrenceFrequency: dto.isRecurring
          ? (dto.recurrenceFrequency ?? 'MONTHLY')
          : null,
      },
    });
  }

  async update(
    userId: string,
    transactionId: string,
    dto: CreateTransactionDto,
  ) {
    const updated = await this.prisma.transaction.updateMany({
      where: {
        id: transactionId,
        userId,
      },
      data: {
        amount: dto.amount,
        type: dto.type,
        category: dto.category.trim(),
        categoryColor: dto.categoryColor ?? null,
        description: dto.description?.trim() || null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        isRecurring: dto.isRecurring ?? false,
        recurrenceFrequency: dto.isRecurring
          ? (dto.recurrenceFrequency ?? 'MONTHLY')
          : null,
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Transação não encontrada');
    }

    return { updated: true };
  }

  async remove(userId: string, transactionId: string) {
    const target = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      select: { id: true, recurrenceSourceId: true, occurredAt: true },
    });

    const deleted = await this.prisma.transaction.deleteMany({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!target || deleted.count === 0) {
      throw new NotFoundException('Transação não encontrada');
    }

    // Excluir a ocorrência mais recente encerra a série; senão ela seria recriada
    const seriesId = target.recurrenceSourceId ?? target.id;
    const series = await this.findActiveSeries(userId);
    const active = series.find((s) => s.seriesId === seriesId);
    if (active && active.head.occurredAt <= target.occurredAt) {
      await this.prisma.transaction.update({
        where: { id: active.head.id },
        data: { isRecurring: false },
      });
    }

    return { deleted: true };
  }
}
