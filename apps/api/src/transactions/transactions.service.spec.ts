import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prismaMock: {
    transaction: {
      groupBy: jest.Mock;
      findMany: jest.Mock;
      createMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      transaction: {
        groupBy: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
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
    const [[call]] = prismaMock.transaction.groupBy.mock.calls as [
      [
        {
          by: string[];
          where: { userId: string; occurredAt: { gte: Date; lt: Date } };
        },
      ],
    ];
    expect(call.by).toEqual(['type']);
    expect(call.where.userId).toBe('user-1');
    expect(call.where.occurredAt.gte.getFullYear()).toBe(2026);
    expect(call.where.occurredAt.gte.getMonth()).toBe(2);
    expect(call.where.occurredAt.lt.getFullYear()).toBe(2026);
    expect(call.where.occurredAt.lt.getMonth()).toBe(3);
  });

  it('deve retornar zero quando não existir tipo no agrupamento', async () => {
    prismaMock.transaction.groupBy.mockResolvedValue([
      { type: 'EXPENSE', _sum: { amount: 900 } },
    ]);

    const result = await service.summary('user-1', 4, 2026);

    expect(result.income).toBe(0);
    expect(result.expense).toBe(900);
    expect(result.balance).toBe(-900);
  });

  it('deve propagar erro do prisma em caso de falha', async () => {
    prismaMock.transaction.groupBy.mockRejectedValue(
      new Error('Falha no banco'),
    );

    await expect(service.summary('user-1', 4, 2026)).rejects.toThrow(
      'Falha no banco',
    );
  });

  describe('recorrência', () => {
    const baseTx = {
      userId: 'user-1',
      amount: 160,
      type: 'EXPENSE',
      category: 'Reserva Transporte',
      categoryColor: '#383838',
      categoryId: null,
      description: null,
      isRecurring: true,
      recurrenceFrequency: 'MONTHLY',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    function monthsFromNow(delta: number, day = 10) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + delta, day, 12);
    }

    afterEach(() => jest.useRealTimers());

    it('lança as ocorrências vencidas que faltam (servidor dormindo no dia)', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          ...baseTx,
          id: 'root',
          recurrenceSourceId: null,
          occurredAt: monthsFromNow(-3, 1),
        },
      ]);

      await service.materializeRecurring('user-1');

      const [[{ data }]] = prismaMock.transaction.createMany.mock.calls as [
        [{ data: Array<{ occurredAt: Date; recurrenceSourceId: string }> }],
      ];
      expect(data).toHaveLength(3);
      expect(data.every((d) => d.recurrenceSourceId === 'root')).toBe(true);
    });

    it('continua a partir da ocorrência mais recente da série', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          ...baseTx,
          id: 'root',
          recurrenceSourceId: null,
          occurredAt: monthsFromNow(-2, 1),
        },
        {
          ...baseTx,
          id: 'copy-1',
          recurrenceSourceId: 'root',
          occurredAt: monthsFromNow(-1, 1),
        },
        {
          ...baseTx,
          id: 'copy-2',
          recurrenceSourceId: 'root',
          occurredAt: monthsFromNow(0, 1),
        },
      ]);

      await service.materializeRecurring('user-1');

      expect(prismaMock.transaction.createMany).not.toHaveBeenCalled();
    });

    it('não gera nada quando a ocorrência mais recente deixou de ser recorrente', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          ...baseTx,
          id: 'root',
          recurrenceSourceId: null,
          occurredAt: monthsFromNow(-3, 1),
        },
        {
          ...baseTx,
          id: 'copy-1',
          recurrenceSourceId: 'root',
          isRecurring: false,
          occurredAt: monthsFromNow(-2, 1),
        },
      ]);

      await service.materializeRecurring('user-1');

      expect(prismaMock.transaction.createMany).not.toHaveBeenCalled();
    });

    it('projeta a despesa mensal no mês seguinte', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          ...baseTx,
          id: 'root',
          recurrenceSourceId: null,
          occurredAt: monthsFromNow(0, 1),
        },
      ]);

      const next = monthsFromNow(1, 1);
      const result = await service.projected(
        'user-1',
        next.getMonth() + 1,
        next.getFullYear(),
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        projected: true,
        amount: 160,
        category: 'Reserva Transporte',
      });
      expect(result[0].occurredAt.getMonth()).toBe(next.getMonth());
    });

    it('mantém o dia original em meses curtos (31/01 → 28/02 → 31/03)', async () => {
      jest.useFakeTimers({ now: new Date(2027, 0, 31, 13) });
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          ...baseTx,
          id: 'root',
          recurrenceSourceId: null,
          occurredAt: new Date(2027, 0, 31, 12),
        },
      ]);

      const feb = await service.projected('user-1', 2, 2027);
      const mar = await service.projected('user-1', 3, 2027);

      expect(feb[0].occurredAt.getDate()).toBe(28);
      expect(mar[0].occurredAt.getDate()).toBe(31);
    });
  });
});
