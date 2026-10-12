import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Atrás do proxy do Render, o IP real do cliente vem no X-Forwarded-For.
  // Sem isso, todos os usuários teriam o IP do proxy e dividiriam o mesmo rate limit.
  const trustProxy = Number(process.env.TRUST_PROXY ?? 1);
  app.set('trust proxy', Number.isFinite(trustProxy) ? trustProxy : 1);

  // Headers de segurança (X-Content-Type-Options, HSTS, etc.)
  app.use(helmet());

  // Ativa a validação globalmente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN;

  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((origin) => origin.trim())
      : true,
  });
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  console.log(`Backend rodando na porta ${port}`);
}
void bootstrap();
