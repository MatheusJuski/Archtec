import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { calendarSyncThrottle } from '../throttle.config';
import {
  CalendarSourcesService,
  type UploadedIcsFile,
} from './calendar-sources.service';
import {
  CreateCalendarSourceDto,
  ImportCalendarFileDto,
  UpdateCalendarSourceDto,
} from './dto/calendar-source.dto';
import { MAX_ICS_BYTES } from './ics-fetcher';

@Controller('calendar-sources')
@UseGuards(JwtAuthGuard)
export class CalendarSourcesController {
  constructor(
    private readonly calendarSourcesService: CalendarSourcesService,
  ) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.calendarSourcesService.findAll(req.user.userId);
  }

  @Post()
  @Throttle(calendarSyncThrottle)
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCalendarSourceDto,
  ) {
    return this.calendarSourcesService.createFromUrl(req.user.userId, dto);
  }

  @Post('import')
  @Throttle(calendarSyncThrottle)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_ICS_BYTES, files: 1 },
    }),
  )
  importFile(
    @Request() req: AuthenticatedRequest,
    @UploadedFile() file: UploadedIcsFile | undefined,
    @Body() dto: ImportCalendarFileDto,
  ) {
    return this.calendarSourcesService.importFile(req.user.userId, file, dto);
  }

  @Post('sync')
  @Throttle(calendarSyncThrottle)
  syncStale(@Request() req: AuthenticatedRequest) {
    return this.calendarSourcesService.syncStale(req.user.userId);
  }

  @Post(':id/sync')
  @Throttle(calendarSyncThrottle)
  sync(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.calendarSourcesService.sync(req.user.userId, id);
  }

  @Patch(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarSourceDto,
  ) {
    return this.calendarSourcesService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.calendarSourcesService.remove(req.user.userId, id);
  }
}
