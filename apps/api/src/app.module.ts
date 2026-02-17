import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module'; // Verifique se esta linha existe
import { PrismaModule } from './prisma/prisma.module';
import { NotesModule } from './notes/notes.module';

@Module({
  imports: [PrismaModule, UsersModule, NotesModule], // O UsersModule PRECISA estar aqui
  controllers: [],
  providers: [],
})
export class AppModule {}