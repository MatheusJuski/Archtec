import { Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
import { throttlerOptions } from './throttle.config';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({
  imports: [ThrottlerModule.forRoot(throttlerOptions)],
  controllers: [UsersController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: UsersService,
      useValue: { login: () => ({ access_token: 'x' }) },
    },
    {
      provide: PrismaService,
      useValue: { $queryRaw: () => Promise.resolve([]) },
    },
  ],
})
class TestModule {}

describe('Rate limit por IP', () => {
  let app: NestExpressApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(TestModule, {
      logger: false,
    });
    app.set('trust proxy', 1);
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  const login = (ip: string) =>
    fetch(`${baseUrl}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ email: 'a@a.com', password: '123456' }),
    });

  it('bloqueia o login após 10 tentativas por minuto do mesmo IP', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await login('203.0.113.1')).status).toBe(201);
    }
    const blocked = await login('203.0.113.1');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });

  it('conta cada IP separadamente (atrás do proxy)', async () => {
    expect((await login('203.0.113.2')).status).toBe(201);
  });

  it('não limita as rotas de keep-alive', async () => {
    for (let i = 0; i < 130; i++) {
      const res = await fetch(`${baseUrl}/up`, {
        headers: { 'X-Forwarded-For': '203.0.113.3' },
      });
      expect(res.status).toBe(200);
    }
  });
});
