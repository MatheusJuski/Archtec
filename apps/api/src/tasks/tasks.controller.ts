import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
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

  @Post()
  create(
    @Request() req,
    @Body() body: { title: string; parentId?: string | null },
  ) {
    return this.tasksService.createTask(req.user.userId, body);
  }

  @Patch(':id/move')
  move(
    @Request() req,
    @Param('id') id: string,
    @Body('parentId') parentId: string | null,
  ) {
    return this.tasksService.moveTask(id, req.user.userId, parentId);
  }
}
