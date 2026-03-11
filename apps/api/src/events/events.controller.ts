import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(@Request() req) {
    return this.eventsService.findAll(req.user.userId);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateEventDto) {
    return this.eventsService.create(req.user.userId, dto);
  }
}
