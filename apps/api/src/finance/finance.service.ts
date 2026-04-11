import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountEntryDto } from './dto/create-account-entry.dto';
import { CreateGoalDto } from './dto/create-goal.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getGoals(userId: string, month: number, year: number) {
    return this.prisma.monthlyGoal.findMany({
      where: { userId, month, year },
      orderBy: [{ category: 'asc' }],
    });
  }

  async upsertGoal(userId: string, dto: CreateGoalDto) {
    return this.prisma.monthlyGoal.upsert({
      where: {
        userId_month_year_category: {
          userId,
          month: dto.month,
          year: dto.year,
          category: dto.category.trim(),
        },
      },
      create: {
        userId,
        month: dto.month,
        year: dto.year,
        category: dto.category.trim(),
        targetAmount: dto.targetAmount,
      },
      update: {
        targetAmount: dto.targetAmount,
      },
    });
  }

  async deleteGoal(userId: string, goalId: string) {
    const deleted = await this.prisma.monthlyGoal.deleteMany({
      where: { id: goalId, userId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Meta não encontrada');
    }

    return { deleted: true };
  }

  private async markOverdue(userId: string) {
    await this.prisma.accountEntry.updateMany({
      where: {
        userId,
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });
  }

  async listAccounts(userId: string, month?: number, year?: number) {
    await this.markOverdue(userId);

    const where: any = { userId };

    if (month && year) {
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 1, 0, 0, 0, 0);
      where.dueDate = { gte: start, lt: end };
    }

    return this.prisma.accountEntry.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createAccount(userId: string, dto: CreateAccountEntryDto) {
    return this.prisma.accountEntry.create({
      data: {
        userId,
        type: dto.type,
        amount: dto.amount,
        category: dto.category.trim(),
        description: dto.description?.trim() || null,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  async markAccountPaid(userId: string, id: string) {
    const updated = await this.prisma.accountEntry.updateMany({
      where: { id, userId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Lançamento não encontrado');
    }

    return { paid: true };
  }

  async deleteAccount(userId: string, id: string) {
    const deleted = await this.prisma.accountEntry.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Lançamento não encontrado');
    }

    return { deleted: true };
  }

  async healthSummary(userId: string) {
    await this.markOverdue(userId);

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);

    const [
      tasksOverdue,
      tasksDueToday,
      eventsToday,
      notesTotal,
      txGrouped,
      accountsDue,
    ] = await Promise.all([
      this.prisma.task.count({
        where: {
          userId,
          status: { not: 'completed' },
          dueDate: { lt: startToday },
        },
      }),
      this.prisma.task.count({
        where: {
          userId,
          status: { not: 'completed' },
          dueDate: { gte: startToday, lte: endToday },
        },
      }),
      this.prisma.event.count({
        where: {
          userId,
          startTime: { gte: startToday, lte: endToday },
        },
      }),
      this.prisma.note.count({ where: { userId } }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          userId,
          occurredAt: { gte: startMonth, lt: endMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.accountEntry.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lte: endToday },
        },
        select: { amount: true, type: true },
      }),
    ]);

    const income = txGrouped.find((t) => t.type === 'INCOME')?._sum.amount ?? 0;
    const expense = txGrouped.find((t) => t.type === 'EXPENSE')?._sum.amount ?? 0;

    const receivableOpen = accountsDue
      .filter((a) => a.type === 'RECEIVABLE')
      .reduce((sum, item) => sum + item.amount, 0);

    const payableOpen = accountsDue
      .filter((a) => a.type === 'PAYABLE')
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      tasksOverdue,
      tasksDueToday,
      eventsToday,
      notesTotal,
      monthIncome: income,
      monthExpense: expense,
      monthBalance: income - expense,
      receivableOpen,
      payableOpen,
    };
  }

  async monthInsights(userId: string, month?: number, year?: number) {
    await this.markOverdue(userId);

    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    const startMonth = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
    const endMonth = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const elapsedDays =
      now.getMonth() + 1 === targetMonth && now.getFullYear() === targetYear
        ? Math.max(now.getDate(), 1)
        : daysInMonth;

    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        occurredAt: { gte: startMonth, lt: endMonth },
      },
      _sum: { amount: true },
    });

    const income = grouped.find((g) => g.type === 'INCOME')?._sum.amount ?? 0;
    const expense = grouped.find((g) => g.type === 'EXPENSE')?._sum.amount ?? 0;

    const dailyExpenseAverage = elapsedDays > 0 ? expense / elapsedDays : 0;
    const projectedExpense = dailyExpenseAverage * daysInMonth;

    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const nextWeek = new Date(startToday);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [overdueCount, dueSoonCount] = await Promise.all([
      this.prisma.accountEntry.count({
        where: {
          userId,
          status: 'OVERDUE',
        },
      }),
      this.prisma.accountEntry.count({
        where: {
          userId,
          status: 'PENDING',
          dueDate: { gte: startToday, lte: nextWeek },
        },
      }),
    ]);

    return {
      month: targetMonth,
      year: targetYear,
      income,
      expense,
      projectedExpense,
      projectedBalance: income - projectedExpense,
      overdueCount,
      dueSoonCount,
      daysInMonth,
      elapsedDays,
    };
  }
}
