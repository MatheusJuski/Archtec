import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module'; // Verifique se esta linha existe
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, UsersModule], // O UsersModule PRECISA estar aqui
  controllers: [],
  providers: [],
})
export class AppModule {}