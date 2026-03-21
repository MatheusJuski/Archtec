import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type SearchItemType = 'note' | 'task' | 'event';

export interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle?: string;
  url: string;
  createdAt: Date;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchAll(userId: string, query: string): Promise<SearchItem[]> {
    const term = query.trim();
    if (!term) {
      return [];
    }

    const [notes, tasks, events] = await Promise.all([
      this.prisma.note.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { content: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
        },
        take: 20,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
        take: 20,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.event.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { task: { title: { contains: term, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          createdAt: true,
          task: {
            select: {
              title: true,
            },
          },
        },
        take: 20,
        orderBy: { startTime: 'desc' },
      }),
    ]);

    const noteItems: SearchItem[] = notes.map((item) => ({
      id: item.id,
      type: 'note',
      title: item.title || 'Sem título',
      subtitle: item.content?.replace(/<[^>]+>/g, ' ').trim().slice(0, 100),
      url: `/notes/${item.id}`,
      createdAt: item.createdAt,
    }));

    const taskItems: SearchItem[] = tasks.map((item) => ({
      id: item.id,
      type: 'task',
      title: item.title,
      subtitle: `${item.priority} • ${item.status}`,
      url: `/tasks?taskId=${item.id}`,
      createdAt: item.createdAt,
    }));

    const eventItems: SearchItem[] = events.map((item) => ({
      id: item.id,
      type: 'event',
      title: item.title,
      subtitle: `${item.task?.title ? `${item.task.title} • ` : ''}${new Date(item.startTime).toLocaleString('pt-BR')}`,
      url: `/calendar?eventId=${item.id}`,
      createdAt: item.createdAt,
    }));

    return [...noteItems, ...taskItems, ...eventItems].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
