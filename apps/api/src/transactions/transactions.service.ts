import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
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
    const lastDayOfTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
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

  @Cron('0 0 * * *')
  async processMonthlyRecurringTransactions() {
    const now = new Date();
    const todayDay = now.getDate();

    const recurring = await this.prisma.transaction.findMany({
      where: {
        isRecurring: true,
        recurrenceFrequency: 'MONTHLY',
        occurredAt: {
          lte: now,
        },
      },
      orderBy: {
        occurredAt: 'asc',
      },
    });

    if (!recurring.length) {
      return;
    }

    let createdCount = 0;

    for (const tx of recurring) {
      if (tx.occurredAt.getDate() !== todayDay) {
        continue;
      }

      const nextDate = this.normalizeMonthlyDate(tx.occurredAt, 1);
      const nextStart = new Date(nextDate);
      nextStart.setHours(0, 0, 0, 0);
      const nextEnd = new Date(nextDate);
      nextEnd.setHours(23, 59, 59, 999);

      const alreadyExists = await this.prisma.transaction.findFirst({
        where: {
          userId: tx.userId,
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          description: tx.description,
          isRecurring: true,
          recurrenceFrequency: 'MONTHLY',
          occurredAt: {
            gte: nextStart,
            lte: nextEnd,
          },
        },
        select: { id: true },
      });

      if (alreadyExists) {
        continue;
      }

      await this.prisma.transaction.create({
        data: {
          userId: tx.userId,
          amount: tx.amount,
          type: tx.type,
          category: tx.category,
          description: tx.description,
          occurredAt: nextDate,
          isRecurring: true,
          recurrenceFrequency: 'MONTHLY',
        },
      });

      createdCount += 1;
    }

    if (createdCount > 0) {
      this.logger.log(`Recurring monthly transactions generated: ${createdCount}`);
    }
  }

  async summary(userId: string, month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);

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
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);

    const grouped = await this.prisma.transaction.groupBy({
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
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
    });

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
      amount: item._sum.amount ?? 0,
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

  findAll(userId: string) {
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
        recurrenceFrequency: dto.isRecurring ? dto.recurrenceFrequency ?? 'MONTHLY' : null,
      },
    });
  }

  async update(userId: string, transactionId: string, dto: CreateTransactionDto) {
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
        recurrenceFrequency: dto.isRecurring ? dto.recurrenceFrequency ?? 'MONTHLY' : null,
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Transação não encontrada');
    }

    return { updated: true };
  }

  async remove(userId: string, transactionId: string) {
    const deleted = await this.prisma.transaction.deleteMany({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Transação não encontrada');
    }

    return { deleted: true };
  }
}
