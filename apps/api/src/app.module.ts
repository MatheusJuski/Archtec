import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { throttlerOptions } from './throttle.config';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotesModule } from './notes/notes.module';
import { TasksModule } from './tasks/tasks.module';
import { EventsModule } from './events/events.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SearchModule } from './search/search.module';
import { HealthController } from './health.controller';
import { FinanceModule } from './finance/finance.module';
import { CalendarSourcesModule } from './calendar-sources/calendar-sources.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(throttlerOptions),
    PrismaModule,
    UsersModule,
    NotesModule,
    TasksModule,
    EventsModule,
    CalendarSourcesModule,
    TransactionsModule,
    FinanceModule,
    SearchModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
