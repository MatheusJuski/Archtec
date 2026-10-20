import { Module } from '@nestjs/common';
import { CalendarSourcesController } from './calendar-sources.controller';
import { CalendarSourcesService } from './calendar-sources.service';

@Module({
  controllers: [CalendarSourcesController],
  providers: [CalendarSourcesService],
})
export class CalendarSourcesModule {}
