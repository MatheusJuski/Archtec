import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaMock: { $queryRaw: jest.Mock };

  beforeEach(() => {
    prismaMock = { $queryRaw: jest.fn() };
    controller = new HealthController(prismaMock as unknown as PrismaService);
  });

  it('live responde ok sem consultar o banco', () => {
    expect(controller.live().status).toBe('ok');
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('check reporta banco up quando a consulta funciona', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(controller.check()).resolves.toMatchObject({ status: 'ok', database: 'up' });
  });

  it('check lança 503 quando o banco falha', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('down'));
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
