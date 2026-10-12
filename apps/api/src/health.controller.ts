import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness sem tocar no banco: mantém a API acordada sem impedir o Postgres (Neon) de hibernar.
   * - /health/live: usado pelo ping externo (cron).
   * - /up: usado pelo frontend; nome neutro porque bloqueadores de anúncio barram URLs com "health".
   */
  @Get(['health/live', 'up'])
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health')
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        database: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
