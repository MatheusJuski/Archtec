import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateEventDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Data/hora inválida');
    }

    if (end <= start) {
      throw new BadRequestException('A hora de término deve ser posterior ao início');
    }

    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({
        where: {
          id: dto.taskId,
          userId,
        },
        select: { id: true },
      });

      if (!task) {
        throw new BadRequestException('Tarefa inválida para vincular ao evento');
      }
    }

    return this.prisma.event.create({
      data: {
        title: dto.title.trim(),
        startTime: start,
        endTime: end,
        userId,
        taskId: dto.taskId ?? null,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.event.findMany({
      where: { userId },
      orderBy: { startTime: 'asc' },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });
  }
}
