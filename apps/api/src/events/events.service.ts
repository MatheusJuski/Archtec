import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

const EVENT_PAST_GRACE_DAYS = 1;
const EVENT_FUTURE_LIMIT_YEARS = 10;

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateEventDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    const now = new Date();
    const minAllowed = new Date(now);
    minAllowed.setDate(minAllowed.getDate() - EVENT_PAST_GRACE_DAYS);

    const maxAllowed = new Date(now);
    maxAllowed.setFullYear(maxAllowed.getFullYear() + EVENT_FUTURE_LIMIT_YEARS);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Data/hora inválida');
    }

    if (end <= start) {
      throw new BadRequestException('A hora de término deve ser posterior ao início');
    }

    if (start < minAllowed || start > maxAllowed || end < minAllowed || end > maxAllowed) {
      throw new BadRequestException(
        `Eventos só podem ficar entre 1 dia no passado e ${EVENT_FUTURE_LIMIT_YEARS} anos no futuro`,
      );
    }

    const overlappingEvent = await this.prisma.event.findFirst({
      where: {
        userId,
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
      },
    });

    if (overlappingEvent) {
      throw new ConflictException(
        `Conflito de horário com "${overlappingEvent.title}" (${overlappingEvent.startTime.toISOString()} - ${overlappingEvent.endTime.toISOString()})`,
      );
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

    if (dto.noteId) {
      const note = await this.prisma.note.findFirst({
        where: {
          id: dto.noteId,
          userId,
        },
        select: { id: true },
      });

      if (!note) {
        throw new BadRequestException('Nota inválida para vincular ao evento');
      }
    }

    return this.prisma.event.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        startTime: start,
        endTime: end,
        userId,
        taskId: dto.taskId ?? null,
        noteId: dto.noteId ?? null,
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
        note: {
          select: {
            id: true,
            title: true,
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
        note: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  async remove(userId: string, eventId: string) {
    const deleted = await this.prisma.event.deleteMany({
      where: {
        id: eventId,
        userId,
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Evento não encontrado');
    }

    return { deleted: true };
  }

  async removeAll(userId: string) {
    const deleted = await this.prisma.event.deleteMany({
      where: { userId },
    });

    return { deletedCount: deleted.count };
  }
}
