import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Request() req, @Query('tree') tree?: string) {
    const buildTree = tree === 'true';
    return this.tasksService.findAll(req.user.userId, buildTree);
  }
}
