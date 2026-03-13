import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotesModule } from './notes/notes.module';
import { TasksModule } from './tasks/tasks.module';
import { EventsModule } from './events/events.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [PrismaModule, UsersModule, NotesModule, TasksModule, EventsModule, TransactionsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}