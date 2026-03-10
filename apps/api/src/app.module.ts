import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotesModule } from './notes/notes.module';
import { TasksModule } from './tasks/tasks.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [PrismaModule, UsersModule, NotesModule, TasksModule, EventsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}