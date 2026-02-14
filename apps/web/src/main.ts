import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Habilita o CORS para que o Frontend (porta 5173) consiga falar com o Backend (porta 3333)
  app.enableCors();
  
  await app.listen(3333);
}
bootstrap();