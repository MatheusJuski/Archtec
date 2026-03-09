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

  async moveTask(
    taskId: string,
    userId: string,
    parentId: string | null,
    order?: number,
  ) {
    const task = await this.prisma.task.update({
      where: { id: taskId, userId },
      data: { parentId },
    });

    if (order !== undefined) {
      // Busca todos os irmãos no destino (mesmo parentId), ordenados
      const siblings = await this.prisma.task.findMany({
        where: { userId, parentId },
        orderBy: { order: 'asc' },
        select: { id: true },
      });

      // Recalcula a ordem: remove o item movido e reinsere na posição desejada
      const ids = siblings.map((s) => s.id).filter((id) => id !== taskId);
      const clampedOrder = Math.max(0, Math.min(order, ids.length));
      ids.splice(clampedOrder, 0, taskId);

      // Batch update de cada irmão com sua nova ordem
      await this.prisma.$transaction(
        ids.map((id, idx) =>
          this.prisma.task.update({
            where: { id },
            data: { order: idx },
          }),
        ),
      );
    }

    return task;
  }

  async completeTask(taskId: string, userId: string) {
    const now = new Date();

    // CTE recursiva: coleta taskId + todos os descendentes
    await this.prisma.$executeRaw`
      WITH RECURSIVE descendants AS (
        SELECT id FROM tasks WHERE id = ${taskId} AND "userId" = ${userId}
        UNION ALL
        SELECT t.id FROM tasks t INNER JOIN descendants d ON t."parentId" = d.id
      )
      UPDATE tasks SET status = 'completed', "completedAt" = ${now}, "updatedAt" = ${now}
      WHERE id IN (SELECT id FROM descendants)
    `;

    return this.findAll(userId, true);
  }

  async uncompleteTask(taskId: string, userId: string) {
    const now = new Date();

    await this.prisma.$executeRaw`
      WITH RECURSIVE descendants AS (
        SELECT id FROM tasks WHERE id = ${taskId} AND "userId" = ${userId}
        UNION ALL
        SELECT t.id FROM tasks t INNER JOIN descendants d ON t."parentId" = d.id
      )
      UPDATE tasks SET status = 'pending', "completedAt" = NULL, "updatedAt" = ${now}
      WHERE id IN (SELECT id FROM descendants)
    `;

    return this.findAll(userId, true);
  }

  async toggleComplete(taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { status: true },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status === 'completed') {
      return this.uncompleteTask(taskId, userId);
    }
    return this.completeTask(taskId, userId);
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
