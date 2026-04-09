import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prismaMock: {
    transaction: {
      groupBy: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      transaction: {
        groupBy: jest.fn(),
      },
    };

    service = new TransactionsService(prismaMock as unknown as PrismaService);
  });

  it('deve calcular income, expense e balance corretamente', async () => {
    prismaMock.transaction.groupBy.mockResolvedValue([
      { type: 'INCOME', _sum: { amount: 3500 } },
      { type: 'EXPENSE', _sum: { amount: 1250 } },
    ]);

    const result = await service.summary('user-1', 3, 2026);

    expect(result).toEqual({
      month: 3,
      year: 2026,
      income: 3500,
      expense: 1250,
      balance: 2250,
    });

    expect(prismaMock.transaction.groupBy).toHaveBeenCalledTimes(1);
    const call = prismaMock.transaction.groupBy.mock.calls[0][0];
    expect(call.by).toEqual(['type']);
    expect(call.where.userId).toBe('user-1');
    expect(call.where.occurredAt.gte.getFullYear()).toBe(2026);
    expect(call.where.occurredAt.gte.getMonth()).toBe(2);
    expect(call.where.occurredAt.lt.getFullYear()).toBe(2026);
    expect(call.where.occurredAt.lt.getMonth()).toBe(3);
  });

  it('deve retornar zero quando não existir tipo no agrupamento', async () => {
    prismaMock.transaction.groupBy.mockResolvedValue([{ type: 'EXPENSE', _sum: { amount: 900 } }]);

    const result = await service.summary('user-1', 4, 2026);

    expect(result.income).toBe(0);
    expect(result.expense).toBe(900);
    expect(result.balance).toBe(-900);
  });

  it('deve propagar erro do prisma em caso de falha', async () => {
    prismaMock.transaction.groupBy.mockRejectedValue(new Error('Falha no banco'));

    await expect(service.summary('user-1', 4, 2026)).rejects.toThrow('Falha no banco');
  });
});
