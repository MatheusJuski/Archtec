import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.eventsService.findAll(req.user.userId);
  }

  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateEventDto) {
    return this.eventsService.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.eventsService.remove(req.user.userId, id);
  }

  @Delete()
  removeAll(@Request() req: AuthenticatedRequest) {
    return this.eventsService.removeAll(req.user.userId);
  }
}
