import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

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
        description: dto.description?.trim() || null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      },
    });
  }
}
