import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards, NotFoundException } from '@nestjs/common';
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
    @Body()
    body: {
      title: string;
      parentId?: string | null;
      dueDate?: string | null;
      isRecurring?: boolean;
      recurrenceFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null;
    },
  ) {
    return this.tasksService.createTask(req.user.userId, body);
  }

  @Patch(':id/move')
  move(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { parentId: string | null; order?: number },
  ) {
    return this.tasksService.moveTask(id, req.user.userId, body.parentId, body.order);
  }

  @Patch(':id/toggle')
  async toggleComplete(@Request() req, @Param('id') id: string) {
    try {
      return await this.tasksService.toggleComplete(id, req.user.userId);
    } catch {
      throw new NotFoundException('Tarefa não encontrada');
    }
  }
}
