import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Ativa a validação globalmente
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, 
    forbidNonWhitelisted: true, 
  }));

  app.enableCors();
  await app.listen(3333);
  console.log('Backend rodando em http://localhost:3333');
}
bootstrap();