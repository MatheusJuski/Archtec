import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

const EVENT_PAST_GRACE_DAYS = 1;
const EVENT_FUTURE_LIMIT_YEARS = 10;

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  private addRecurrenceDate(source: Date, recurrenceFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY') {
    const next = new Date(source);
    switch (recurrenceFrequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'YEARLY':
        next.setFullYear(next.getFullYear() + 1);
        break;
      case 'MONTHLY':
      default:
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  @Cron('0 0 * * *')
  async processRecurringEvents() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const recurringEvents = await this.prisma.event.findMany({
      where: {
        isRecurring: true,
        recurrenceFrequency: { in: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] },
        endTime: { lte: now },
      },
      orderBy: { endTime: 'asc' },
    });

    for (const event of recurringEvents) {
      const recurrenceFrequency = event.recurrenceFrequency ?? 'MONTHLY';
      const nextStart = this.addRecurrenceDate(event.startTime, recurrenceFrequency);
      const nextEnd = this.addRecurrenceDate(event.endTime, recurrenceFrequency);

      if (nextStart < todayStart || nextStart > todayEnd) {
        continue;
      }

      const exists = await this.prisma.event.findFirst({
        where: {
          userId: event.userId,
          title: event.title,
          isRecurring: true,
          recurrenceFrequency,
          startTime: {
            gte: new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate(), 0, 0, 0, 0),
            lt: new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() + 1, 0, 0, 0, 0),
          },
        },
        select: { id: true },
      });

      if (!exists) {
        await this.prisma.event.create({
          data: {
            userId: event.userId,
            title: event.title,
            description: event.description,
            startTime: nextStart,
            endTime: nextEnd,
            taskId: event.taskId,
            noteId: event.noteId,
            isRecurring: true,
            recurrenceFrequency,
          },
        });
      }
    }
  }

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
        isRecurring: dto.isRecurring ?? false,
        recurrenceFrequency: dto.isRecurring ? dto.recurrenceFrequency ?? 'MONTHLY' : null,
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
