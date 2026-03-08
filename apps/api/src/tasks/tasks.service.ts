import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TaskWithChildren {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  order: number;
  dueDate: Date | null;
  completedAt: Date | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  children?: TaskWithChildren[];
}

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retorna todas as tarefas do usuário.
   * @param userId - ID do usuário autenticado
   * @param tree 
   */
  async findAll(userId: string, tree = false): Promise<TaskWithChildren[]> {
    const tasks = await this.prisma.task.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });

    if (!tree) {
      return tasks;
    }

    return this.buildTree(tasks);
  }



  async createTask(
    userId: string,
    data: { title: string; parentId?: string | null },
  ) {
    const count = await this.prisma.task.count({ where: { userId } });
    return this.prisma.task.create({
      data: {
        title: data.title,
        userId,
        parentId: data.parentId ?? null,
        order: count,
      },
    });
  }


  async moveTask(taskId: string, userId: string, parentId: string | null) {
    return this.prisma.task.update({
      where: { id: taskId, userId },
      data: { parentId },
    });
  }

  private buildTree(tasks: TaskWithChildren[]): TaskWithChildren[] {
    const map = new Map<string, TaskWithChildren>();

    // Indexa todas as tarefas por ID e inicializa children
    for (const task of tasks) {
      map.set(task.id, { ...task, children: [] });
    }

    const roots: TaskWithChildren[] = [];

    for (const task of map.values()) {
      if (task.parentId && map.has(task.parentId)) {
        map.get(task.parentId)!.children!.push(task);
      } else {
        roots.push(task);
      }
    }

    return roots;
  }
}
