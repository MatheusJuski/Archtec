import { Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateAccountEntryDto } from './dto/create-account-entry.dto';
import { CreateGoalDto } from './dto/create-goal.dto';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

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
    // Só atrasa a partir do dia seguinte ao vencimento
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    await this.prisma.accountEntry.updateMany({
      where: {
        userId,
        status: 'PENDING',
        dueDate: { lt: startToday },
      },
      data: { status: 'OVERDUE' },
    });
  }

  async listAccounts(userId: string, month?: number, year?: number) {
    await this.markOverdue(userId);

    const where: Prisma.AccountEntryWhereInput = { userId };

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

  /** Quitar a conta lança a transação correspondente: ela passa a contar como realizada em todo o app. */
  async markAccountPaid(userId: string, id: string) {
    const entry = await this.prisma.accountEntry.findFirst({
      where: { id, userId },
    });

    if (!entry) {
      throw new NotFoundException('Lançamento não encontrado');
    }
    if (entry.status === 'PAID') {
      return { paid: true };
    }

    const paidAt = new Date();
    await this.prisma.$transaction([
      this.prisma.accountEntry.update({
        where: { id },
        data: { status: 'PAID', paidAt },
      }),
      this.prisma.transaction.create({
        data: {
          userId,
          type: entry.type === 'PAYABLE' ? 'EXPENSE' : 'INCOME',
          amount: entry.amount,
          category: entry.category,
          description: entry.description,
          occurredAt: paidAt,
        },
      }),
    ]);

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

  /**
   * Totais do mês. Realizado: transações (contas quitadas já viram transação).
   * Previsto (ainda por vir): recorrências futuras + contas em aberto com vencimento no mês.
   */
  private async monthTotals(userId: string, start: Date, end: Date) {
    // Também lança as ocorrências recorrentes vencidas antes de somar
    const projected = await this.transactions.projectRecurring(
      userId,
      start,
      end,
    );

    const [grouped, open] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { userId, occurredAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      this.prisma.accountEntry.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { gte: start, lt: end },
        },
        select: { type: true, amount: true },
      }),
    ]);

    const sum = (items: { amount: number }[]) =>
      items.reduce((total, item) => total + item.amount, 0);

    return {
      income: grouped.find((g) => g.type === 'INCOME')?._sum.amount ?? 0,
      expense: grouped.find((g) => g.type === 'EXPENSE')?._sum.amount ?? 0,
      plannedIncome:
        sum(projected.filter((tx) => tx.type === 'INCOME')) +
        sum(open.filter((a) => a.type === 'RECEIVABLE')),
      plannedExpense:
        sum(projected.filter((tx) => tx.type === 'EXPENSE')) +
        sum(open.filter((a) => a.type === 'PAYABLE')),
    };
  }

  async healthSummary(userId: string) {
    await this.markOverdue(userId);

    const now = new Date();
    const startMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const endMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    );
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);

    const [
      tasksOverdue,
      tasksDueToday,
      eventsToday,
      notesTotal,
      totals,
      accountsOpen,
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
      this.monthTotals(userId, startMonth, endMonth),
      // Em aberto: atrasadas + as que ainda vencem neste mês
      this.prisma.accountEntry.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: endMonth },
        },
        select: { amount: true, type: true },
      }),
    ]);

    const receivableOpen = accountsOpen
      .filter((a) => a.type === 'RECEIVABLE')
      .reduce((sum, item) => sum + item.amount, 0);

    const payableOpen = accountsOpen
      .filter((a) => a.type === 'PAYABLE')
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      tasksOverdue,
      tasksDueToday,
      eventsToday,
      notesTotal,
      monthIncome: totals.income,
      monthExpense: totals.expense,
      monthBalance: totals.income - totals.expense,
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
    const isFutureMonth = startMonth > now;
    const elapsedDays = isFutureMonth
      ? 0
      : now.getMonth() + 1 === targetMonth && now.getFullYear() === targetYear
        ? Math.max(now.getDate(), 1)
        : daysInMonth;

    const { income, expense, plannedIncome, plannedExpense } =
      await this.monthTotals(userId, startMonth, endMonth);

    const dailyExpenseAverage = elapsedDays > 0 ? expense / elapsedDays : 0;
    const projectedExpense = Math.max(
      dailyExpenseAverage * daysInMonth,
      expense + plannedExpense,
    );
    const projectedIncome = income + plannedIncome;

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
      plannedIncome,
      plannedExpense,
      projectedIncome,
      projectedExpense,
      projectedBalance: projectedIncome - projectedExpense,
      overdueCount,
      dueSoonCount,
      daysInMonth,
      elapsedDays,
    };
  }
}
