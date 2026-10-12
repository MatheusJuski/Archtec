import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
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

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.eventsService.remove(req.user.userId, id);
  }

  @Delete()
  removeAll(@Request() req: AuthenticatedRequest) {
    return this.eventsService.removeAll(req.user.userId);
  }
}
