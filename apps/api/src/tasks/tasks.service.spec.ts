import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

type Row = { id: string; userId: string; parentId: string | null };

/**
 * Árvore de exemplo (usuário u1):  A → B → C
 * Tarefa de outro usuário (u2):     X
 */
const rows: Row[] = [
  { id: 'A', userId: 'u1', parentId: null },
  { id: 'B', userId: 'u1', parentId: 'A' },
  { id: 'C', userId: 'u1', parentId: 'B' },
  { id: 'X', userId: 'u2', parentId: null },
];

describe('TasksService - validação do pai', () => {
  let service: TasksService;
  let prismaMock: {
    task: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      task: {
        findFirst: jest.fn(
          ({ where }: { where: { id: string; userId: string } }) =>
            Promise.resolve(
              rows.find(
                (r) => r.id === where.id && r.userId === where.userId,
              ) ?? null,
            ),
        ),
        update: jest.fn((args: unknown) => Promise.resolve(args)),
        create: jest.fn((args: unknown) => Promise.resolve(args)),
        count: jest.fn(() => Promise.resolve(0)),
        findMany: jest.fn(() => Promise.resolve([])),
      },
      $transaction: jest.fn(() => Promise.resolve([])),
    };
    service = new TasksService(prismaMock as unknown as PrismaService);
  });

  it('move para um pai válido do mesmo usuário', async () => {
    await expect(service.moveTask('C', 'u1', 'A')).resolves.toBeDefined();
    expect(prismaMock.task.update).toHaveBeenCalled();
  });

  it('move para a raiz', async () => {
    await expect(service.moveTask('C', 'u1', null)).resolves.toBeDefined();
  });

  it('recusa pai de outro usuário', async () => {
    await expect(service.moveTask('C', 'u1', 'X')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it('recusa a própria tarefa como pai', async () => {
    await expect(service.moveTask('B', 'u1', 'B')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('recusa mover para dentro de uma descendente (ciclo)', async () => {
    await expect(service.moveTask('A', 'u1', 'C')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it('recusa mover tarefa de outro usuário', async () => {
    await expect(service.moveTask('X', 'u1', null)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('recusa criar subtarefa sob pai de outro usuário', async () => {
    await expect(
      service.createTask('u1', { title: 't', parentId: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });
});
