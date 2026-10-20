import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const EVENT_PAST_GRACE_DAYS = 1;
const EVENT_FUTURE_LIMIT_YEARS = 10;
const READ_ONLY_SOURCE_MESSAGE =
  'Este evento vem de um calendário sincronizado por link. Altere-o no Google/Outlook.';

const EVENT_INCLUDE = {
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
  calendarSource: {
    select: {
      id: true,
      name: true,
      color: true,
      type: true,
    },
  },
} satisfies Prisma.EventInclude;

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  private addRecurrenceDate(
    source: Date,
    recurrenceFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
  ) {
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
      const nextStart = this.addRecurrenceDate(
        event.startTime,
        recurrenceFrequency,
      );
      const nextEnd = this.addRecurrenceDate(
        event.endTime,
        recurrenceFrequency,
      );

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
            gte: new Date(
              nextStart.getFullYear(),
              nextStart.getMonth(),
              nextStart.getDate(),
              0,
              0,
              0,
              0,
            ),
            lt: new Date(
              nextStart.getFullYear(),
              nextStart.getMonth(),
              nextStart.getDate() + 1,
              0,
              0,
              0,
              0,
            ),
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
            location: event.location,
            startTime: nextStart,
            endTime: nextEnd,
            allDay: event.allDay,
            taskId: event.taskId,
            noteId: event.noteId,
            isRecurring: true,
            recurrenceFrequency,
          },
        });
      }
    }
  }

  private parseTimes(startTime: string | Date, endTime: string | Date) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Data/hora inválida');
    }

    if (end <= start) {
      throw new BadRequestException(
        'A hora de término deve ser posterior ao início',
      );
    }

    return { start, end };
  }

  private assertWithinWindow(start: Date, end: Date) {
    const now = new Date();
    const minAllowed = new Date(now);
    minAllowed.setDate(minAllowed.getDate() - EVENT_PAST_GRACE_DAYS);

    const maxAllowed = new Date(now);
    maxAllowed.setFullYear(maxAllowed.getFullYear() + EVENT_FUTURE_LIMIT_YEARS);

    if (
      start < minAllowed ||
      start > maxAllowed ||
      end < minAllowed ||
      end > maxAllowed
    ) {
      throw new BadRequestException(
        `Eventos só podem ficar entre 1 dia no passado e ${EVENT_FUTURE_LIMIT_YEARS} anos no futuro`,
      );
    }
  }

  /**
   * Conflito de horário só vale entre eventos com hora criados no app.
   * Eventos de dia inteiro e importados de calendários externos podem se sobrepor.
   */
  private async assertNoOverlap(
    userId: string,
    start: Date,
    end: Date,
    ignoreEventId?: string,
  ) {
    const overlappingEvent = await this.prisma.event.findFirst({
      where: {
        userId,
        calendarSourceId: null,
        allDay: false,
        startTime: { lt: end },
        endTime: { gt: start },
        ...(ignoreEventId ? { id: { not: ignoreEventId } } : {}),
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
  }

  private async assertTaskOwned(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    });

    if (!task) {
      throw new BadRequestException('Tarefa inválida para vincular ao evento');
    }
  }

  private async assertNoteOwned(userId: string, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
      select: { id: true },
    });

    if (!note) {
      throw new BadRequestException('Nota inválida para vincular ao evento');
    }
  }

  async create(userId: string, dto: CreateEventDto) {
    const { start, end } = this.parseTimes(dto.startTime, dto.endTime);
    const allDay = dto.allDay ?? false;

    this.assertWithinWindow(start, end);
    if (!allDay) {
      await this.assertNoOverlap(userId, start, end);
    }
    if (dto.taskId) {
      await this.assertTaskOwned(userId, dto.taskId);
    }
    if (dto.noteId) {
      await this.assertNoteOwned(userId, dto.noteId);
    }

    return this.prisma.event.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        location: dto.location?.trim() || null,
        startTime: start,
        endTime: end,
        allDay,
        isRecurring: dto.isRecurring ?? false,
        recurrenceFrequency: dto.isRecurring
          ? (dto.recurrenceFrequency ?? 'MONTHLY')
          : null,
        userId,
        taskId: dto.taskId ?? null,
        noteId: dto.noteId ?? null,
      },
      include: EVENT_INCLUDE,
    });
  }

  async update(userId: string, eventId: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
      include: { calendarSource: { select: { type: true } } },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    if (event.calendarSource?.type === 'ICS_URL') {
      throw new BadRequestException(READ_ONLY_SOURCE_MESSAGE);
    }

    const allDay = dto.allDay ?? event.allDay;
    const timesChanged =
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      allDay !== event.allDay;

    const { start, end } = this.parseTimes(
      dto.startTime ?? event.startTime,
      dto.endTime ?? event.endTime,
    );

    // Só valida janela/conflito quando o horário muda: assim dá para editar
    // o título de um evento antigo (ex.: importado de um arquivo .ics).
    if (timesChanged) {
      this.assertWithinWindow(start, end);
      if (!allDay && !event.calendarSourceId) {
        await this.assertNoOverlap(userId, start, end, event.id);
      }
    }

    if (dto.noteId) {
      await this.assertNoteOwned(userId, dto.noteId);
    }

    const isRecurring = dto.isRecurring ?? event.isRecurring;

    return this.prisma.event.update({
      where: { id: event.id },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : undefined,
        location:
          dto.location !== undefined ? dto.location?.trim() || null : undefined,
        startTime: start,
        endTime: end,
        allDay,
        noteId: dto.noteId !== undefined ? (dto.noteId ?? null) : undefined,
        isRecurring,
        recurrenceFrequency: isRecurring
          ? (dto.recurrenceFrequency ?? event.recurrenceFrequency ?? 'MONTHLY')
          : null,
      },
      include: EVENT_INCLUDE,
    });
  }

  findAll(userId: string) {
    return this.prisma.event.findMany({
      where: { userId },
      orderBy: { startTime: 'asc' },
      include: EVENT_INCLUDE,
    });
  }

  async remove(userId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
      select: { id: true, calendarSource: { select: { type: true } } },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    if (event.calendarSource?.type === 'ICS_URL') {
      throw new BadRequestException(READ_ONLY_SOURCE_MESSAGE);
    }

    await this.prisma.event.delete({ where: { id: event.id } });

    return { deleted: true };
  }

  /** Remove só os eventos criados no app; calendários externos são removidos pela fonte. */
  async removeAll(userId: string) {
    const deleted = await this.prisma.event.deleteMany({
      where: { userId, calendarSourceId: null },
    });

    return { deletedCount: deleted.count };
  }
}
